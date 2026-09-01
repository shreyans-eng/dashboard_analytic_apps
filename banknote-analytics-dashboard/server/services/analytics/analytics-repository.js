/**
 * Per-product BigQuery repository.
 * Fallback order: summary table → product view → raw events_*.
 * MVP KPIs 1, 3–5, 8–10 share product_daily_signals when the summary exists.
 * MVP 2 (same-day first ID) always uses dedicated SQL joined on user_pseudo_id.
 * MVP 7 (scans / user) uses dedicated SQL so P10–P99 can be computed at user-day grain.
 * Cohort LTV reads Mongo; BigQuery only if LTV_FORCE_RAW or empty + fallback flag.
 */
import fs from 'fs';
import path from 'path';
import { cacheKey, cached } from '../../cache/index.js';
import { createBigQueryClient, runQuery } from './bigquery-client.js';
import { prepareSql, isMissingTableError, isMissingColumnError } from './sql-utils.js';
import { resolveSql } from '../query-library.js';
import { detectIntraday, getIntradayStatus } from './intraday.js';
import {
  clipRowsToCompleteExport,
  hasDimensionFilter,
  requestedRangeHasIncompleteDates,
  shouldUseSummaryForDau,
} from './dau-definition.js';
import { summarizePackRows, yearlyListPrice } from './subscription-packs.js';
import {
  cohortLtvMongoReady,
  countCohortLtv,
  queryCohortLtv,
} from './cohort-ltv-mongo.js';

const QUERY_MAP = {
  dau: {
    summary: 'dashboard/summary/01_dau.sql',
    legacy: 'dashboard/01_daily_active_users.sql',
    raw: 'dashboard/raw/01_dau.sql',
    metric: 'dau',
  },
  mau: {
    summary: 'dashboard/summary/02_mau.sql',
    legacy: 'dashboard/02_monthly_active_users.sql',
    raw: 'dashboard/raw/02_mau.sql',
    metric: 'mau',
  },
  'new-users': {
    summary: 'dashboard/summary/03_new_users.sql',
    legacy: 'dashboard/03_new_users.sql',
    raw: 'dashboard/raw/03_new_users.sql',
    metric: 'new-users',
  },
  countries: {
    summary: 'dashboard/summary/04_countries.sql',
    legacy: 'dashboard/04_top_countries.sql',
    raw: 'dashboard/raw/04_countries.sql',
    metric: 'countries',
  },
  'country-list': {
    summary: 'dashboard/summary/04_country_list.sql',
    legacy: 'dashboard/04_country_list.sql',
    raw: 'dashboard/raw/04_country_list.sql',
    metric: 'countries',
  },
  retention: {
    summary: 'dashboard/summary/09_retention.sql',
    legacy: null,
    raw: 'dashboard/raw/09_retention.sql',
    metric: 'retention',
  },
  d1: {
    summary: 'dashboard/summary/05_d1_retention.sql',
    legacy: 'dashboard/05_d1_retention.sql',
    raw: 'dashboard/raw/05_d1_retention.sql',
    metric: 'retention',
  },
  d7: {
    summary: 'dashboard/summary/06_d7_retention.sql',
    legacy: 'dashboard/06_d7_retention.sql',
    raw: 'dashboard/raw/06_d7_retention.sql',
    metric: 'retention',
  },
  events: {
    summary: 'dashboard/summary/07_top_events.sql',
    legacy: 'dashboard/07_top_events.sql',
    raw: 'dashboard/raw/07_top_events.sql',
    metric: 'events',
  },
  platform: {
    summary: 'dashboard/summary/08_platform.sql',
    legacy: 'dashboard/08_platform_breakdown.sql',
    raw: 'dashboard/raw/08_platform.sql',
    metric: 'platform',
  },
  'compare-daily': {
    summary: 'dashboard/summary/16_product_daily_signals.sql',
    legacy: null,
    raw: 'dashboard/raw/16_product_daily_signals.sql',
    metric: 'compare',
  },
  'compare-summary': {
    summary: 'dashboard/summary/16_product_daily_signals.sql',
    legacy: null,
    raw: 'dashboard/raw/16_product_daily_signals.sql',
    metric: 'compare',
  },
  // LTV read-model lives in MongoDB (collection cohort_ltv). BigQuery only at refresh time.
  ltv: {
    raw: 'dashboard/raw/10_cohort_ltv.sql',
    metric: 'ltv',
  },
  'subscription-packs': {
    raw: 'dashboard/raw/18_subscription_packs.sql',
    metric: 'subscription-packs',
  },
  'subscription-tiers': {
    raw: 'dashboard/raw/18_subscription_packs.sql',
    metric: 'subscription-packs',
  },
  'user-mix': {
    raw: 'dashboard/raw/19_user_mix.sql',
    metric: 'user-mix',
  },
  'install-day-usage': {
    raw: 'dashboard/raw/20_install_day_usage.sql',
    metric: 'install-day-usage',
  },
  'd0-d1-percentiles': {
    raw: 'dashboard/raw/23_install_d0_d1_percentiles.sql',
    metric: 'd0-d1-percentiles',
  },
  'scan-limits': {
    raw: 'dashboard/raw/21_scan_limits.sql',
    metric: 'scan-limits',
  },
  'free-scan-quota': {
    raw: 'dashboard/product/coinzy/22_free_scan_success_quota.sql',
    metric: 'free-scan-quota',
  },
};

/**
 * MVP product KPIs (10). productSql uses views; signalKey projects from raw daily signals
 * when preferRaw or views are missing.
 */
const MVP_KPI_MAP = {
  'mvp-dau': {
    productSql: 'dashboard/product/01_dau.sql',
    signalKey: 'dau',
    xKey: 'event_date',
    yKey: 'dau',
  },
  'mvp-time-to-first-scan': {
    productSql: 'dashboard/product/02_time_to_first_scan.sql',
    signalKey: null,
    xKey: 'event_date',
    yKey: 'day0_first_scan_rate',
  },
  'mvp-identify-success': {
    productSql: 'dashboard/product/03_identify_success_rate.sql',
    signalKey: 'identification_success_rate',
    xKey: 'event_date',
    yKey: 'identification_success_rate',
  },
  'mvp-quota-hit': {
    productSql: 'dashboard/product/04_quota_hit_rate.sql',
    signalKey: 'free_quota_hit_rate',
    xKey: 'event_date',
    yKey: 'free_quota_hit_rate',
  },
  'mvp-paywall': {
    productSql: 'dashboard/product/05_paywall_conversion.sql',
    signalKey: 'paywall_to_confirm_rate',
    xKey: 'event_date',
    yKey: 'paywall_to_confirm_rate',
  },
  'mvp-retention': {
    productSql: 'dashboard/product/06_retention_d1_d7.sql',
    signalKey: null,
    xKey: 'cohort_date',
    yKey: 'd1_retention_rate',
    useRetention: true,
  },
  'mvp-scans-per-user': {
    productSql: 'dashboard/product/07_scans_per_user.sql',
    signalKey: 'scans_per_dau',
    xKey: 'event_date',
    yKey: 'scans_per_dau',
  },
  'mvp-identify-funnel': {
    productSql: 'dashboard/product/08_identify_funnel_conversion.sql',
    signalKey: 'open_to_success_rate',
    xKey: 'event_date',
    yKey: 'open_to_success_rate',
  },
  'mvp-catalogue': {
    productSql: 'dashboard/product/09_catalogue_engagement.sql',
    signalKey: null,
    xKey: 'event_date',
    yKey: 'private_collection_open_rate',
  },
  'mvp-marketplace': {
    productSql: 'dashboard/product/10_marketplace_engagement.sql',
    signalKey: 'marketplace_engagement_rate',
    xKey: 'event_date',
    yKey: 'marketplace_engagement_rate',
  },
};

export class AnalyticsRepository {
  constructor({
    sqlRoot,
    project,
    dataset,
    summaryDataset,
    useSummary = true,
    keyFilename = null,
    preferRaw = false,
    productId = 'banknote',
  }) {
    this.sqlRoot = sqlRoot;
    this.project = project;
    this.dataset = dataset;
    this.summaryDataset = summaryDataset;
    this.useSummary = useSummary;
    this.keyFilename = keyFilename;
    this.preferRaw = preferRaw;
    this.productId = productId;
    this.bigquery = createBigQueryClient(project, keyFilename || undefined);
    this.config = { project, dataset, summaryDataset };
    this._exportCompleteness = null;
    this._exportCompletenessAt = 0;
  }

  async init() {
    try {
      await detectIntraday(this.bigquery, this.project, this.dataset);
    } catch (e) {
      console.warn(`[${this.productId}] intraday detect skipped:`, e.message);
    }
  }

  _sqlExists(relativePath) {
    return fs.existsSync(path.join(this.sqlRoot, relativePath));
  }

  /**
   * Prefer product-verified SQL when present:
   * dashboard/product/08_….sql → dashboard/product/coinzy/08_….sql
   * dashboard/raw/16_….sql → dashboard/product/coinzy/16_….sql
   */
  _resolveProductSql(sharedPath) {
    if (!sharedPath) return sharedPath;
    const filename = path.basename(sharedPath);
    const override = `dashboard/product/${this.productId}/${filename}`;
    if (this._sqlExists(override)) return override;
    return sharedPath;
  }

  _sumColumn(rows, key) {
    return (rows || []).reduce((s, r) => s + Number(r?.[key] || 0), 0);
  }

  /**
   * Coinzy summary was historically built with Banknote aliases
   * (Collection_open / Marketplace_open / Subs_confirm), so catalogue,
   * marketplace, and paywall rates stay 0 even though DAU is fine.
   * Collection_screen is high-volume on Coinzy — all-zero catalogue with
   * active DAU means the summary is stale and we must read raw.
   */
  _signalsMissingEngagement(rows) {
    if (this.productId !== 'coinzy') return false;
    if (!rows?.length) return true;
    const dau = this._sumColumn(rows, 'dau');
    if (dau <= 0) return false;
    const catalogue = this._sumColumn(rows, 'catalogue_open_rate');
    // Collection_screen is high-volume on Coinzy. All-zero catalogue with
    // active DAU means the summary still uses Collection_open / Marketplace_open.
    return catalogue === 0;
  }

  async _prepare(relativePath, params) {
    const raw = await resolveSql(this.sqlRoot, relativePath);
    return prepareSql(raw, params, this.config);
  }

  async _executeSql(relativePath, params, source = 'raw') {
    const sql = await this._prepare(relativePath, params);
    const { rows, bytesProcessed } = await runQuery(this.bigquery, sql);
    return {
      sql,
      rows,
      count: rows.length,
      bytesProcessed,
      source,
      product: this.productId,
    };
  }

  async getExportCompleteness() {
    const now = Date.now();
    if (this._exportCompleteness && now - this._exportCompletenessAt < 10 * 60 * 1000) {
      return this._exportCompleteness;
    }
    const sql = `
      SELECT MAX(PARSE_DATE('%Y%m%d', REGEXP_EXTRACT(table_id, r'events_(\\d{8})'))) AS latest_complete_date
      FROM \`${this.project}.${this.dataset}.__TABLES__\`
      WHERE REGEXP_CONTAINS(table_id, r'^events_\\d{8}$')
    `;
    try {
      const { rows } = await runQuery(this.bigquery, sql);
      const raw = rows[0]?.latest_complete_date;
      const latestCompleteDate = raw?.value ?? raw ?? null;
      this._exportCompleteness = {
        latestCompleteDate: latestCompleteDate ? String(latestCompleteDate).slice(0, 10) : null,
        intraday: getIntradayStatus(),
      };
    } catch (e) {
      console.warn(`[${this.productId}] export completeness lookup failed:`, e.message);
      this._exportCompleteness = { latestCompleteDate: null, intraday: getIntradayStatus() };
    }
    this._exportCompletenessAt = now;
    return this._exportCompleteness;
  }

  async _attachCompleteness(result, params = {}, dateKey = 'event_date') {
    const completeness = await this.getExportCompleteness();
    const latestCompleteDate = completeness.latestCompleteDate;
    const rows = clipRowsToCompleteExport(result.rows || [], dateKey, latestCompleteDate);
    const endDate = params.end_date;
    return {
      ...result,
      rows,
      count: rows.length,
      latestCompleteDate,
      incompleteDates: requestedRangeHasIncompleteDates(endDate, latestCompleteDate),
      dataUnavailable: rows.length === 0,
    };
  }

  /**
   * Source selection: preferRaw → raw;
   * else summary → view (legacy) → raw → clear error.
   * Never silently returns zeros when a path fails for non-missing reasons.
   *
   * DAU summary (product_daily_signals) is date-only. Country/platform filters
   * skip it so the dashboard does not return unfiltered DAU.
   */
  async _runNamed(name, params) {
    if (name === 'ltv') return this._runLtv(params);

    const entry = QUERY_MAP[name];
    if (!entry) throw new Error(`Unknown query: ${name}`);

    const skipSummary = name === 'dau' && !shouldUseSummaryForDau(params);
    // Retention summary historically counted any Firebase event (including push).
    // Live D1/D4/D7 always uses raw SQL filtered to session_start / App_open / first_open.
    const forceRawRetention = name === 'retention' || name === 'd1' || name === 'd7';

    if ((this.preferRaw || forceRawRetention) && entry.raw) {
      return this._executeSql(entry.raw, params, 'raw');
    }

    if (this.useSummary && entry.summary && !skipSummary) {
      try {
        return await this._executeSql(entry.summary, params, 'summary');
      } catch (e) {
        if (!isMissingTableError(e) && !isMissingColumnError(e)) throw e;
        console.warn(`[${this.productId}] Summary missing or stale schema for ${name}, falling back to view/raw`);
      }
    }

    if (entry.legacy && name !== 'dau') {
      try {
        return await this._executeSql(entry.legacy, params, 'view');
      } catch (e) {
        if (!isMissingTableError(e) || !entry.raw) throw e;
        console.warn(`[${this.productId}] View missing for ${name}, using raw events`);
      }
    }

    if (entry.raw) {
      if (name === 'country-list') {
        console.warn(`[${this.productId}] country-list using geo.country on events_*`);
      }
      return this._executeSql(entry.raw, params, 'raw');
    }
    throw new Error(
      `No SQL path for ${name} on ${this.productId} (tried summary/view/raw; none available)`,
    );
  }

  /**
   * Cohort LTV: MongoDB read-model (normal path). BigQuery only if explicitly forced.
   */
  async _runLtv(params = {}) {
    const entry = QUERY_MAP.ltv;
    const forceRaw =
      ['1', 'true', 'yes'].includes(String(process.env.LTV_FORCE_RAW || '').toLowerCase()) ||
      params.force_raw === true ||
      String(params.force_raw || '').toLowerCase() === 'true';

    if (forceRaw) {
      console.warn(`[${this.productId}] LTV_FORCE_RAW — scanning BigQuery events_*`);
      return this._executeSql(entry.raw, params, 'raw');
    }

    if (!cohortLtvMongoReady()) {
      throw new Error(
        `[${this.productId}] MongoDB is not configured (MONGODB_URI). ` +
          `Cohort LTV is served from MongoDB — set MONGODB_URI or use LTV_FORCE_RAW=true for emergency BigQuery.`,
      );
    }

    try {
      const result = await queryCohortLtv(this.productId, params);
      if (result.total === 0) {
        const n = await countCohortLtv(this.productId);
        if (n === 0) {
          const allow =
            ['1', 'true', 'yes'].includes(
              String(process.env.LTV_ALLOW_RAW_FALLBACK || '').toLowerCase(),
            );
          if (allow) {
            console.warn(
              `[${this.productId}] MongoDB cohort_ltv empty — LTV_ALLOW_RAW_FALLBACK emergency BigQuery scan`,
            );
            return this._executeSql(entry.raw, params, 'raw');
          }
          throw new Error(
            `[${this.productId}] No LTV rows in MongoDB. Run: ` +
              `PRODUCTS=${this.productId} DAYS=30 LTV_DAYS=210 npm run refresh-ltv:mongo`,
          );
        }
      }
      return result;
    } catch (e) {
      if (String(e.message || e).includes('MongoDB is not connected')) {
        throw new Error(
          `[${this.productId}] MongoDB not connected for LTV. Check MONGODB_URI / network access.`,
        );
      }
      throw e;
    }
  }

  async _cachedQuery(metric, name, params) {
    const key = cacheKey(`${this.productId}:dashboard:${name}`, params);
    return cached(metric, key, () => this._runNamed(name, params));
  }

  async getProductDailySignals(params) {
    const key = cacheKey(`${this.productId}:daily-signals:v11`, params);
    return cached('compare', key, async () => {
      const rawPath = this._resolveProductSql('dashboard/raw/16_product_daily_signals.sql');
      const rawSource = rawPath === 'dashboard/raw/16_product_daily_signals.sql' ? 'raw' : 'product';
      const skipSummary = hasDimensionFilter(params);
      // Coinzy summary was historically Banknote-shaped (Identify_bottom_nav,
      // Subs_confirm). Banknote summary mixed onboarding into in-app paywall.
      const skipStalePaywallSummary = this.productId === 'banknote';

      if (!this.preferRaw && this.useSummary && !skipSummary && !skipStalePaywallSummary) {
        try {
          const summary = await this._executeSql(
            'dashboard/summary/16_product_daily_signals.sql',
            params,
            'summary',
          );
          if (!this._signalsMissingEngagement(summary.rows)) {
            return this._attachCompleteness(summary, params);
          }
          console.warn(
            `[${this.productId}] product_daily_signals summary has no catalogue engagement; using ${rawPath}`,
          );
        } catch (e) {
          if (!isMissingTableError(e) && !isMissingColumnError(e)) throw e;
          console.warn(`[${this.productId}] product_daily_signals summary missing or stale schema, using ${rawPath}`);
        }
      }
      const raw = await this._executeSql(rawPath, params, rawSource);
      return this._attachCompleteness(raw, params);
    });
  }

  async getDailyUsers(params) {
    const key = cacheKey(`${this.productId}:dashboard:dau:v4`, params);
    const result = await cached('dau', key, () => this._runNamed('dau', params));
    return this._attachCompleteness(result, params);
  }

  async getUserMix(params) {
    const key = cacheKey(`${this.productId}:dashboard:user-mix:v1`, params);
    const result = await cached('dau', key, () => this._executeSql('dashboard/raw/19_user_mix.sql', params, 'raw'));
    return this._attachCompleteness(result, params);
  }

  async getInstallDayUsage(params) {
    const key = cacheKey(`${this.productId}:dashboard:install-day-usage:v3`, params);
    const result = await cached('install-day-usage', key, () =>
      this._executeSql('dashboard/raw/20_install_day_usage.sql', params, 'raw'),
    );
    return this._attachCompleteness(result, params);
  }

  async getD0D1Percentiles(params) {
    const key = cacheKey(`${this.productId}:dashboard:d0-d1-percentiles:v2`, params);
    const result = await cached('d0-d1-percentiles', key, () =>
      this._executeSql('dashboard/raw/23_install_d0_d1_percentiles.sql', params, 'raw'),
    );
    return this._attachCompleteness(result, params, 'cohort_date');
  }

  async getScanLimits(params) {
    const sqlPath = this._resolveProductSql('dashboard/raw/21_scan_limits.sql');
    const key = cacheKey(`${this.productId}:dashboard:scan-limits:v2`, params);
    const result = await cached('scan-limits', key, () =>
      this._executeSql(sqlPath, params, 'raw'),
    );
    return this._attachCompleteness(result, params);
  }

  async getSubscriptionPacks(params) {
    const sqlPath = this._resolveProductSql('dashboard/raw/18_subscription_packs.sql');
    const key = cacheKey(`${this.productId}:dashboard:subscription-packs:v6`, params);
    const result = await cached('subscription-packs', key, () =>
      this._executeSql(sqlPath, params, 'raw'),
    );
    const clipped = await this._attachCompleteness(result, params);
    return {
      ...clipped,
      yearly_list_price: yearlyListPrice(this.productId),
      ...summarizePackRows(clipped.rows, this.productId),
    };
  }

  async getFreeScanQuota(params) {
    const sqlPath = `dashboard/product/${this.productId}/22_free_scan_success_quota.sql`;
    if (!this._sqlExists(sqlPath)) {
      return {
        rows: [],
        count: 0,
        sql: null,
        bytesProcessed: 0,
        source: 'none',
        product: this.productId,
        status: 'insufficient_instrumentation',
        message: 'Banknote free-scan success quota events are not mapped yet.',
      };
    }
    const key = cacheKey(`${this.productId}:dashboard:free-scan-quota:v1`, params);
    const result = await cached('free-scan-quota', key, () =>
      this._executeSql(sqlPath, params, 'raw'),
    );
    return this._attachCompleteness(result, params);
  }

  async getMonthlyUsers(params) {
    return this._cachedQuery('mau', 'mau', params);
  }

  async getNewUsers(params) {
    return this._cachedQuery('new-users', 'new-users', params);
  }

  async getCountries(params) {
    return this._cachedQuery('countries', 'countries', params);
  }

  async getTopEvents(params) {
    return this._cachedQuery('events', 'events', params);
  }

  async getPlatformBreakdown(params) {
    return this._cachedQuery('platform', 'platform', params);
  }

  async getRetention(params) {
    const key = cacheKey(`${this.productId}:dashboard:retention:v4`, params);
    return cached('retention', key, async () => {
      try {
        const result = await this._runNamed('retention', params);
        const hasD4 = (result.rows || []).some(
          (r) => r.d4_retention_rate != null || r.d4_d7_retention_rate != null,
        );
        if (hasD4 || !this._sqlExists('dashboard/raw/09_retention.sql')) {
          return result;
        }
        console.warn(`[${this.productId}] Retention summary has no D4/D4–D7; using raw`);
        return await this._executeSql('dashboard/raw/09_retention.sql', params, 'raw');
      } catch (e) {
        // Summary may be missing, or combined retention may have no legacy path.
        // Fall back to merging D1 + D7 (views or raw).
        const msg = String(e?.message || e);
        const canFallback =
          isMissingTableError(e) || msg.includes('No SQL path for retention');
        if (!canFallback) throw e;

        console.warn(`[${this.productId}] Retention combined path failed (${msg.slice(0, 80)}), merging d1+d7`);
        const [d1, d7] = await Promise.all([
          this._runNamed('d1', params),
          this._runNamed('d7', params),
        ]);
        const d7ByDate = new Map(
          (d7.rows || []).map((r) => [String(r.cohort_date?.value || r.cohort_date), r]),
        );
        const rows = (d1.rows || []).map((r) => {
          const keyDate = String(r.cohort_date?.value || r.cohort_date);
          const d7row = d7ByDate.get(keyDate);
          return {
            ...r,
            retained_d7: d7row?.retained_d7,
            d7_retention_rate: d7row?.d7_retention_rate,
          };
        });
        return {
          sql: d1.sql,
          rows,
          count: rows.length,
          bytesProcessed: (d1.bytesProcessed || 0) + (d7.bytesProcessed || 0),
        };
      }
    });
  }

  async getD1Retention(params) {
    const result = await this.getRetention(params);
    return {
      ...result,
      rows: result.rows.map((r) => ({
        cohort_date: r.cohort_date,
        cohort_size: r.cohort_size,
        retained_d1: r.retained_d1,
        d1_retention_rate: r.d1_retention_rate,
      })),
    };
  }

  async getD7Retention(params) {
    const result = await this.getRetention(params);
    return {
      ...result,
      rows: result.rows.map((r) => ({
        cohort_date: r.cohort_date,
        cohort_size: r.cohort_size,
        retained_d7: r.retained_d7,
        d7_retention_rate: r.d7_retention_rate,
      })),
    };
  }

  async getKpi(params) {
    const key = cacheKey(`${this.productId}:kpi:v2`, params);
    return cached('kpi', key, async () => {
      const dauResult = await this.getDailyUsers(params);
      const latestDau = dauResult.rows.length
        ? Number(dauResult.rows[dauResult.rows.length - 1].dau)
        : null;

      if (this.preferRaw || hasDimensionFilter(params)) {
        const signals = await this.getProductDailySignals(params);
        const rows = signals.rows || [];
        const installs = rows.reduce((s, r) => s + Number(r.installs || 0), 0);
        return {
          dau: latestDau,
          mau: 0,
          newUsers: installs,
          d1: 0,
          d7: 0,
        };
      }

      try {
        const { rows } = await this._executeSql('dashboard/summary/kpi.sql', params);
        if (rows[0]) {
          return {
            dau: latestDau,
            mau: Number(rows[0].mau || 0),
            newUsers: Number(rows[0].newUsers || 0),
            d1: Number(rows[0].d1 || 0),
            d7: Number(rows[0].d7 || 0),
          };
        }
      } catch (e) {
        if (!isMissingTableError(e)) throw e;
      }

      const [mau, newUsers, retention] = await Promise.all([
        this._runNamed('mau', params).catch(() => ({ rows: [] })),
        this._runNamed('new-users', params),
        this.getRetention(params).catch(() => ({ rows: [] })),
      ]);

      const latestMau = mau.rows.length ? mau.rows[mau.rows.length - 1].mau : 0;
      const totalNew = newUsers.rows.reduce((s, r) => s + Number(r.new_users || 0), 0);
      const d1Weighted = retention.rows.reduce(
        (acc, r) => ({
          retained: acc.retained + Number(r.retained_d1 || 0),
          size: acc.size + Number(r.cohort_size || 0),
        }),
        { retained: 0, size: 0 },
      );
      const d7Weighted = retention.rows.reduce(
        (acc, r) => ({
          retained: acc.retained + Number(r.retained_d7 || 0),
          size: acc.size + Number(r.cohort_size || 0),
        }),
        { retained: 0, size: 0 },
      );

      return {
        dau: latestDau,
        mau: Number(latestMau),
        newUsers: totalNew,
        d1: d1Weighted.size ? d1Weighted.retained / d1Weighted.size : 0,
        d7: d7Weighted.size ? d7Weighted.retained / d7Weighted.size : 0,
      };
    });
  }

  async getSummaryFreshness() {
    const tables = [
      'daily_active_users',
      'monthly_active_users',
      'daily_new_users',
      'daily_retention',
      'country_metrics',
      'platform_metrics',
      'top_events',
      'product_daily_signals',
    ];

    const freshness = {};
    await Promise.all(tables.map(async (table) => {
      try {
        const sql = `
          SELECT MAX(refreshed_at) AS last_refresh
          FROM \`${this.project}.${this.summaryDataset}.${table}\`
        `;
        const { rows } = await runQuery(this.bigquery, sql);
        freshness[table] = rows[0]?.last_refresh || null;
      } catch {
        freshness[table] = null;
      }
    }));

    const timestamps = Object.values(freshness).filter(Boolean);
    const lastRefresh = timestamps.length
      ? timestamps.reduce((a, b) => (a > b ? a : b))
      : null;
    const completeness = await this.getExportCompleteness();

    return {
      tables: freshness,
      lastRefresh,
      intraday: getIntradayStatus(),
      latestCompleteDate: completeness.latestCompleteDate,
      product: this.productId,
      project: this.project,
      dataset: this.dataset,
    };
  }

  async ping() {
    return runQuery(this.bigquery, 'SELECT 1 AS ok');
  }

  async runRawSql(sql) {
    return runQuery(this.bigquery, sql);
  }

  async runCustomSql(sql, params) {
    const prepared = prepareSql(sql, params, this.config);
    return runQuery(this.bigquery, prepared);
  }

  async runDashboardQuery(name, params) {
    if (MVP_KPI_MAP[name]) {
      return this.getMvpMetric(name, params);
    }

    const handlers = {
      dau: () => this.getDailyUsers(params),
      'user-mix': () => this.getUserMix(params),
      'install-day-usage': () => this.getInstallDayUsage(params),
      'd0-d1-percentiles': () => this.getD0D1Percentiles(params),
      'scan-limits': () => this.getScanLimits(params),
      'subscription-packs': () => this.getSubscriptionPacks(params),
      'subscription-tiers': () => this.getSubscriptionPacks(params),
      'free-scan-quota': () => this.getFreeScanQuota(params),
      mau: () => this.getMonthlyUsers(params),
      'new-users': () => this.getNewUsers(params),
      countries: () => this.getCountries(params),
      'country-list': () => this._cachedQuery('countries', 'country-list', params),
      retention: () => this.getRetention(params),
      d1: () => this.getD1Retention(params),
      d7: () => this.getD7Retention(params),
      events: () => this.getTopEvents(params),
      platform: () => this.getPlatformBreakdown(params),
      'compare-daily': () => this.getProductDailySignals(params),
      'compare-summary': () => this.getProductDailySignals(params),
      ltv: () => this._cachedQuery('ltv:v5', 'ltv', params),
    };
    const fn = handlers[name];
    if (fn) return fn();
    if (QUERY_MAP[name]) {
      return this._cachedQuery(`${QUERY_MAP[name].metric || name}:v2`, name, params);
    }
    throw new Error(`Unknown query: ${name}`);
  }

  /**
   * Run one of the 10 MVP product KPIs.
   * Prefer summary product_daily_signals (one cheap table, shared cache).
   * Product-folder / view SQL when there is no signal column (time-to-first-scan,
   * scans / user percentiles).
   */
  async getMvpMetric(name, params) {
    const spec = MVP_KPI_MAP[name];
    if (!spec) throw new Error(`Unknown MVP metric: ${name}`);

    const key = cacheKey(`${this.productId}:mvp:v16:${name}`, params);
    const result = await cached('kpi', key, async () => {
      if (spec.useRetention) {
        return this.getRetention(params);
      }

      const skipSignals = (name === 'mvp-dau' && !shouldUseSummaryForDau(params))
        || name === 'mvp-paywall';
      const needUserDayGrain = name === 'mvp-scans-per-user';
      if (spec.signalKey && !this.preferRaw && !skipSignals && !needUserDayGrain) {
        try {
          const fromSignals = await this._mvpFromSignals(spec, params);
          if (!this._mvpSignalsEmpty(fromSignals.rows, spec.yKey)) {
            return fromSignals;
          }
          console.warn(
            `[${this.productId}] MVP ${name} signals all null for ${spec.yKey}; trying product SQL`,
          );
        } catch (e) {
          console.warn(`[${this.productId}] MVP ${name} signals failed, trying product SQL: ${e.message}`);
        }
      }

      const productSql = this._resolveProductSql(spec.productSql);
      if (productSql) {
        try {
          const source = productSql.includes('/raw/') ? 'raw' : 'product';
          return await this._executeSql(productSql, params, source);
        } catch (e) {
          if (!isMissingTableError(e)) throw e;
          console.warn(`[${this.productId}] MVP ${name} SQL missing table, falling back`);
        }
      }

      if (name === 'mvp-time-to-first-scan' && this._sqlExists('dashboard/raw/02_time_to_first_scan.sql')) {
        return this._executeSql('dashboard/raw/02_time_to_first_scan.sql', params, 'raw');
      }

      if (spec.signalKey) {
        return this._mvpFromSignals(spec, params);
      }

      return {
        sql: `-- ${name}: no raw fallback; deploy product views or refresh summaries`,
        rows: [],
        count: 0,
        bytesProcessed: 0,
      };
    });

    if (spec.useRetention) return result;
    return this._attachCompleteness(result, params, spec.xKey || 'event_date');
  }

  _mvpSignalsEmpty(rows, yKey) {
    if (!rows?.length) return true;
    return rows.every((r) => {
      const v = r[yKey];
      return v == null || v === '' || (typeof v === 'number' && !Number.isFinite(v));
    });
  }

  async _mvpFromSignals(spec, params) {
    const signals = await this.getProductDailySignals(params);
    const rows = (signals.rows || []).map((r) => ({
      event_date: r.event_date,
      [spec.yKey]: r[spec.signalKey],
      // keep extras for tooltips / tables
      dau: r.dau,
      installs: r.installs,
    }));
    return {
      sql: signals.sql,
      rows,
      count: rows.length,
      bytesProcessed: signals.bytesProcessed,
      source: signals.source,
      latestCompleteDate: signals.latestCompleteDate,
      incompleteDates: signals.incompleteDates,
      dataUnavailable: signals.dataUnavailable,
    };
  }
}
