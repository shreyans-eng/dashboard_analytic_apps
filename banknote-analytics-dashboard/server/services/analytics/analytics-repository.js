import fs from 'fs';
import path from 'path';
import { cacheKey, cached } from '../../cache/index.js';
import { createBigQueryClient, runQuery } from './bigquery-client.js';
import { prepareSql, readSqlFile, isMissingTableError } from './sql-utils.js';
import { detectIntraday, getIntradayStatus } from './intraday.js';

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
    signalKey: 'catalogue_open_rate',
    xKey: 'event_date',
    yKey: 'catalogue_open_rate',
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
   */
  _resolveProductSql(sharedPath) {
    if (!sharedPath) return sharedPath;
    const filename = path.basename(sharedPath);
    const override = `dashboard/product/${this.productId}/${filename}`;
    if (this._sqlExists(override)) return override;
    return sharedPath;
  }

  _prepare(relativePath, params) {
    const raw = readSqlFile(this.sqlRoot, relativePath);
    return prepareSql(raw, params, this.config);
  }

  async _executeSql(relativePath, params, source = 'raw') {
    const sql = this._prepare(relativePath, params);
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

  /**
   * Source selection: preferRaw → raw;
   * else summary → view (legacy) → raw → clear error.
   * Never silently returns zeros when a path fails for non-missing reasons.
   */
  async _runNamed(name, params) {
    const entry = QUERY_MAP[name];
    if (!entry) throw new Error(`Unknown query: ${name}`);

    if (this.preferRaw && entry.raw) {
      return this._executeSql(entry.raw, params, 'raw');
    }

    if (this.useSummary && entry.summary) {
      try {
        return await this._executeSql(entry.summary, params, 'summary');
      } catch (e) {
        if (!isMissingTableError(e)) throw e;
        console.warn(`[${this.productId}] Summary missing for ${name}, falling back to view/raw`);
      }
    }

    if (entry.legacy) {
      try {
        return await this._executeSql(entry.legacy, params, 'view');
      } catch (e) {
        if (!isMissingTableError(e) || !entry.raw) throw e;
        console.warn(`[${this.productId}] View missing for ${name}, using raw events`);
      }
    }

    if (entry.raw) return this._executeSql(entry.raw, params, 'raw');
    throw new Error(
      `No SQL path for ${name} on ${this.productId} (tried summary/view/raw; none available)`,
    );
  }

  async _cachedQuery(metric, name, params) {
    const key = cacheKey(`${this.productId}:dashboard:${name}`, params);
    return cached(metric, key, () => this._runNamed(name, params));
  }

  async getProductDailySignals(params) {
    const key = cacheKey(`${this.productId}:daily-signals`, params);
    return cached('compare', key, async () => {
      if (!this.preferRaw && this.useSummary) {
        try {
          return await this._executeSql(
            'dashboard/summary/16_product_daily_signals.sql',
            params,
            'summary',
          );
        } catch (e) {
          if (!isMissingTableError(e)) throw e;
          console.warn(`[${this.productId}] product_daily_signals summary missing, using raw`);
        }
      }
      return this._executeSql('dashboard/raw/16_product_daily_signals.sql', params, 'raw');
    });
  }

  async getDailyUsers(params) {
    return this._cachedQuery('dau', 'dau', params);
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
    const key = cacheKey(`${this.productId}:dashboard:retention`, params);
    return cached('retention', key, async () => {
      try {
        return await this._runNamed('retention', params);
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
    const key = cacheKey(`${this.productId}:kpi`, params);
    return cached('kpi', key, async () => {
      if (this.preferRaw) {
        const signals = await this.getProductDailySignals(params);
        const rows = signals.rows || [];
        const latest = rows[rows.length - 1];
        const installs = rows.reduce((s, r) => s + Number(r.installs || 0), 0);
        return {
          dau: Number(latest?.dau || 0),
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
            dau: Number(rows[0].dau || 0),
            mau: Number(rows[0].mau || 0),
            newUsers: Number(rows[0].newUsers || 0),
            d1: Number(rows[0].d1 || 0),
            d7: Number(rows[0].d7 || 0),
          };
        }
      } catch (e) {
        if (!isMissingTableError(e)) throw e;
      }

      const [dau, mau, newUsers, retention] = await Promise.all([
        this._runNamed('dau', params),
        this._runNamed('mau', params).catch(() => ({ rows: [] })),
        this._runNamed('new-users', params),
        this.getRetention(params).catch(() => ({ rows: [] })),
      ]);

      const latestDau = dau.rows.length ? dau.rows[dau.rows.length - 1].dau : 0;
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
        dau: Number(latestDau),
        mau: Number(latestMau),
        newUsers: totalNew,
        d1: d1Weighted.size ? d1Weighted.retained / d1Weighted.size : 0,
        d7: d7Weighted.size ? d7Weighted.retained / d7Weighted.size : 0,
      };
    });
  }

  async getExecutive(params) {
    const key = cacheKey(`${this.productId}:executive`, params);
    return cached('executive', key, async () => {
      const [kpi, dau, mau, newUsers, countries, platform, events, retention] = await Promise.all([
        this.getKpi(params),
        this.getDailyUsers(params),
        this.getMonthlyUsers(params).catch(() => ({ rows: [] })),
        this.getNewUsers(params),
        this.getCountries(params),
        this.getPlatformBreakdown(params),
        this.getTopEvents(params),
        this.getRetention(params).catch(() => ({ rows: [] })),
      ]);

      return {
        kpi: {
          dau: kpi.dau,
          mau: kpi.mau,
          newUsers: kpi.newUsers,
          d1: kpi.d1,
          d7: kpi.d7,
        },
        dau: dau.rows,
        mau: mau.rows,
        newUsers: newUsers.rows,
        countries: countries.rows,
        platform: platform.rows,
        events: events.rows,
        retention: retention.rows,
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

    return {
      tables: freshness,
      lastRefresh,
      intraday: getIntradayStatus(),
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
      mau: () => this.getMonthlyUsers(params),
      'new-users': () => this.getNewUsers(params),
      countries: () => this.getCountries(params),
      retention: () => this.getRetention(params),
      d1: () => this.getD1Retention(params),
      d7: () => this.getD7Retention(params),
      events: () => this.getTopEvents(params),
      platform: () => this.getPlatformBreakdown(params),
      'compare-daily': () => this.getProductDailySignals(params),
      'compare-summary': () => this.getProductDailySignals(params),
    };
    const fn = handlers[name];
    if (!fn) throw new Error(`Unknown query: ${name}`);
    return fn();
  }

  /**
   * Run one of the 10 MVP product KPIs.
   * Prefer summary product_daily_signals (one cheap table, shared cache).
   * Product-folder / view SQL only when there is no signal column (time-to-first-scan).
   */
  async getMvpMetric(name, params) {
    const spec = MVP_KPI_MAP[name];
    if (!spec) throw new Error(`Unknown MVP metric: ${name}`);

    const key = cacheKey(`${this.productId}:mvp:${name}`, params);
    return cached('kpi', key, async () => {
      if (spec.useRetention) {
        return this.getRetention(params);
      }

      if (spec.signalKey && !this.preferRaw) {
        try {
          return await this._mvpFromSignals(spec, params);
        } catch (e) {
          console.warn(`[${this.productId}] MVP ${name} signals failed, trying product SQL: ${e.message}`);
        }
      }

      const productSql = this._resolveProductSql(spec.productSql);
      if (productSql) {
        try {
          const source = productSql === spec.productSql ? 'view' : 'product';
          return await this._executeSql(productSql, params, source);
        } catch (e) {
          if (!isMissingTableError(e)) throw e;
          console.warn(`[${this.productId}] MVP ${name} SQL missing table, falling back`);
        }
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
    };
  }
}
