/**
 * Multi-app registry + facade.
 * PRODUCTS=banknote,coinzy,… each gets its own AnalyticsRepository (project, dataset, creds).
 * product=compare fans the same query out in parallel and tags rows — never unions events_*.
 */
import path from 'path';
import fs from 'fs';
import { AnalyticsRepository } from './analytics-repository.js';
import {
  listFunnels,
  getFunnelSteps,
  buildFunnelSql,
  buildEventInventorySql,
  buildEventInventoryFromSummarySql,
  buildEventDailySql,
  buildEventParamsSql,
} from './funnel-registry.js';
import { daysAgo, today } from './sql-utils.js';
import { cacheKey, cached } from '../../cache/index.js';
import { runQuery } from './bigquery-client.js';

const DEFAULT_COLORS = [
  '#4f8cff',
  '#34d399',
  '#fbbf24',
  '#f87171',
  '#a78bfa',
  '#22d3ee',
  '#fb7185',
  '#a3e635',
];

/**
 * Resolve a credentials path relative to the dashboard package root.
 */
export function resolveCredPath(creds, dashboardRoot) {
  if (!creds) return null;
  const resolved = path.isAbsolute(creds) ? creds : path.resolve(dashboardRoot, creds);
  return fs.existsSync(resolved) ? resolved : null;
}

function envKey(id, suffix) {
  return `PRODUCT_${id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${suffix}`;
}

function readEnv(...keys) {
  for (const k of keys) {
    if (k && process.env[k] != null && String(process.env[k]).trim() !== '') {
      return process.env[k];
    }
  }
  return undefined;
}

/**
 * Built-in defaults so Banknote + Coinzy keep working without new env keys.
 * Additional apps: add id to PRODUCTS= and set PRODUCT_<ID>_* vars.
 */
const BUILTIN = {
  banknote: {
    label: 'Banknote',
    project: 'banknote-app-4f3fd',
    dataset: 'analytics_488476338',
    summaryDataset: 'analytics_summary',
    preferRaw: false,
    useSummary: true,
    color: '#4f8cff',
    legacy: {
      project: ['GCP_PROJECT'],
      dataset: ['BQ_DATASET'],
      summaryDataset: ['BQ_SUMMARY_DATASET'],
      credentials: ['GOOGLE_APPLICATION_CREDENTIALS'],
      useSummary: ['USE_SUMMARY_TABLES'],
      preferRaw: [],
    },
  },
  coinzy: {
    label: 'Coinzy',
    project: 'coinzy-26a4d',
    dataset: 'analytics_487601380',
    summaryDataset: 'analytics_summary',
    preferRaw: false,
    useSummary: true,
    color: '#34d399',
    legacy: {
      project: ['COINZY_GCP_PROJECT'],
      dataset: ['COINZY_BQ_DATASET'],
      summaryDataset: ['COINZY_BQ_SUMMARY_DATASET'],
      credentials: ['COINZY_GOOGLE_APPLICATION_CREDENTIALS'],
      useSummary: ['COINZY_USE_SUMMARY_TABLES'],
      preferRaw: ['COINZY_PREFER_RAW'],
    },
  },
};

function parseBool(value, defaultValue) {
  if (value == null || value === '') return defaultValue;
  const v = String(value).toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return defaultValue;
}

function resolveProductIds() {
  const raw = process.env.PRODUCTS || 'banknote,coinzy';
  const ids = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return ids.length ? ids : ['banknote', 'coinzy'];
}

function buildProductConfig(id, index, dashboardRoot) {
  const builtin = BUILTIN[id] || {
    label: id.charAt(0).toUpperCase() + id.slice(1),
    project: '',
    dataset: '',
    summaryDataset: 'analytics_summary',
    preferRaw: true,
    useSummary: false,
    color: DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    legacy: { project: [], dataset: [], summaryDataset: [], credentials: [], useSummary: [], preferRaw: [] },
  };

  const project = readEnv(envKey(id, 'GCP_PROJECT'), ...(builtin.legacy.project || [])) || builtin.project;
  const dataset = readEnv(envKey(id, 'BQ_DATASET'), ...(builtin.legacy.dataset || [])) || builtin.dataset;
  const summaryDataset =
    readEnv(envKey(id, 'BQ_SUMMARY_DATASET'), ...(builtin.legacy.summaryDataset || [])) ||
    builtin.summaryDataset;
  const credentialsPath = resolveCredPath(
    readEnv(envKey(id, 'GOOGLE_APPLICATION_CREDENTIALS'), ...(builtin.legacy.credentials || [])),
    dashboardRoot,
  );

  const preferRawDefault = builtin.preferRaw;
  const useSummaryDefault = builtin.useSummary;

  // preferRaw: PRODUCT_X_PREFER_RAW, else legacy COINZY_PREFER_RAW, else builtin
  let preferRaw = preferRawDefault;
  const preferRawEnv = readEnv(envKey(id, 'PREFER_RAW'), ...(builtin.legacy.preferRaw || []));
  if (preferRawEnv != null) {
    // COINZY_PREFER_RAW !== 'false' historically meant default true
    if (id === 'coinzy' && preferRawEnv === undefined) preferRaw = true;
    else preferRaw = parseBool(preferRawEnv, preferRawDefault);
  } else if (id === 'coinzy') {
    preferRaw = process.env.COINZY_PREFER_RAW !== 'false';
  }

  let useSummary = useSummaryDefault;
  const useSummaryEnv = readEnv(envKey(id, 'USE_SUMMARY'), ...(builtin.legacy.useSummary || []));
  if (useSummaryEnv != null) {
    if (id === 'banknote') useSummary = useSummaryEnv !== 'false';
    else useSummary = parseBool(useSummaryEnv, useSummaryDefault);
  } else if (id === 'banknote') {
    useSummary = process.env.USE_SUMMARY_TABLES !== 'false';
  } else if (id === 'coinzy') {
    useSummary = process.env.COINZY_USE_SUMMARY_TABLES === 'true';
  }

  const label = readEnv(envKey(id, 'LABEL')) || builtin.label;
  const color = readEnv(envKey(id, 'COLOR')) || builtin.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];

  if (!project || !dataset) {
    console.warn(`[products] ${id}: missing project/dataset — set PRODUCT_${id.toUpperCase()}_GCP_PROJECT and _BQ_DATASET`);
  }

  return {
    id,
    label,
    project,
    dataset,
    summaryDataset,
    credentialsPath,
    useSummary,
    preferRaw,
    color,
  };
}

/**
 * Build N product repositories from PRODUCTS= id1,id2,...
 */
export function createProductRepos(dashboardRoot, sqlRoot) {
  const ids = resolveProductIds();
  const configs = {};
  const repos = {};

  ids.forEach((id, index) => {
    const cfg = buildProductConfig(id, index, dashboardRoot);
    configs[id] = cfg;
    repos[id] = new AnalyticsRepository({
      sqlRoot,
      project: cfg.project,
      dataset: cfg.dataset,
      summaryDataset: cfg.summaryDataset,
      useSummary: cfg.useSummary,
      keyFilename: cfg.credentialsPath,
      preferRaw: cfg.preferRaw,
      productId: id,
    });
  });

  const primaryId = ids[0];

  return {
    productIds: ids,
    primaryId,
    configs,
    repos,
    getRepo(productId) {
      if (productId && repos[productId]) return repos[productId];
      return repos[primaryId];
    },
    list() {
      return ids.map((id) => {
        const c = configs[id];
        return {
          id: c.id,
          label: c.label,
          project: c.project,
          dataset: c.dataset,
          credentialsConfigured: Boolean(c.credentialsPath),
          preferRaw: c.preferRaw,
          useSummary: c.useSummary,
          color: c.color,
        };
      });
    },
  };
}

/**
 * Facade: route by product, or merge all registered apps for compare.
 */
export class ProductAnalyticsFacade {
  constructor(registry) {
    this.registry = registry;
  }

  resolveProduct(params = {}) {
    const p = String(params.product || this.registry.primaryId || 'banknote').toLowerCase();
    if (p === 'compare') return 'compare';
    if (this.registry.repos[p]) return p;
    return this.registry.primaryId;
  }

  async runDashboardQuery(name, params = {}) {
    const product = this.resolveProduct(params);

    // Dedicated compare LTV path — never fall through to compare-daily.
    if (name === 'compare-ltv' || (name === 'ltv' && product === 'compare')) {
      return this.compareLtv(params);
    }

    if (
      name === 'compare-subscriptions'
      || (name === 'subscription-tiers' && product === 'compare')
    ) {
      return this.compareSubscriptions(params);
    }

    if (name === 'ltv') {
      return this.registry.getRepo(product).runDashboardQuery('ltv', { ...params, product });
    }

    if (name === 'compare-daily' || name === 'compare-summary') {
      return this.compare(name === 'compare-summary' ? 'summary' : 'daily', params);
    }

    if (product === 'compare' && (name === 'countries' || name === 'country-list')) {
      return this.mergeCountryRows(name, params);
    }

    if (product === 'compare') {
      return this.compare('daily', params);
    }

    const repo = this.registry.getRepo(product);
    return repo.runDashboardQuery(name, { ...params, product });
  }

  async getKpi(params = {}) {
    const product = this.resolveProduct(params);
    if (product === 'compare') {
      const out = {};
      await Promise.all(
        this.registry.productIds.map(async (id) => {
          out[id] = await this.registry.repos[id].getKpi({ ...params, product: id });
        }),
      );
      return out;
    }
    return this.registry.getRepo(product).getKpi({ ...params, product });
  }

  async getSummaryFreshness(params = {}) {
    const product = this.resolveProduct(params);
    if (product === 'compare') {
      const out = {};
      await Promise.all(
        this.registry.productIds.map(async (id) => {
          out[id] = await this.registry.repos[id].getSummaryFreshness();
        }),
      );
      return out;
    }
    return this.registry.getRepo(product).getSummaryFreshness();
  }

  async ping(product) {
    const id = product && this.registry.repos[product] ? product : this.registry.primaryId;
    return this.registry.getRepo(id).ping();
  }

  /** Union of country names across apps for the filter dropdown. */
  async mergeCountryRows(name, params = {}) {
    const results = await Promise.all(
      this.registry.productIds.map(async (id) => {
        try {
          return await this.registry.repos[id].runDashboardQuery(name, { ...params, product: id });
        } catch (e) {
          console.warn(`[compare] ${id} ${name} failed: ${e.message}`);
          return { rows: [], sql: `-- ${id} ${name} failed: ${e.message}`, bytesProcessed: 0 };
        }
      }),
    );
    const seen = new Set();
    const rows = [];
    for (const result of results) {
      for (const row of result.rows || []) {
        const country = String(row.country || '').trim();
        if (!country || country === 'Unknown' || seen.has(country)) continue;
        seen.add(country);
        rows.push({ country });
      }
    }
    rows.sort((a, b) => a.country.localeCompare(b.country));
    return {
      sql: results.map((r) => r.sql).filter(Boolean).join('\n\n'),
      rows,
      count: rows.length,
      bytesProcessed: results.reduce((s, r) => s + (r.bytesProcessed || 0), 0),
      products: this.registry.productIds,
    };
  }

  /**
   * Run daily-signals SQL on every registered product and tag rows.
   */
  async compare(mode, params = {}) {
    const results = await Promise.all(
      this.registry.productIds.map(async (id) => {
        const cfg = this.registry.configs[id];
        try {
          const result = await this.registry.repos[id].getProductDailySignals(params);
          return { id, label: cfg.label, color: cfg.color, result };
        } catch (e) {
          const msg = String(e?.message || e);
          console.error(`[compare] ${id} product_daily_signals failed: ${msg}`);
          return {
            id,
            label: cfg.label,
            color: cfg.color,
            result: {
              rows: [],
              sql: `-- ${cfg.label} failed: ${msg.replace(/\n/g, ' ')}`,
              bytesProcessed: 0,
            },
          };
        }
      }),
    );

    const tagged = results.flatMap(({ label, result }) =>
      (result.rows || []).map((r) => ({ ...r, product: label })),
    );

    const sql = results
      .map(({ label, result }) => `-- ===== ${label} =====\n${result.sql || ''}`)
      .join('\n\n');

    const bytesProcessed = results.reduce((s, x) => s + (x.result.bytesProcessed || 0), 0);
    const products = results.map((r) => r.label);

    if (mode === 'summary') {
      const rows = results
        .map(({ label, result }) =>
          this.summarizeProduct(
            (result.rows || []).map((r) => ({ ...r, product: label })),
            label,
          ),
        )
        .filter(Boolean);
      return { sql, rows, count: rows.length, bytesProcessed, products };
    }

    const rows = tagged.sort((a, b) => {
      const d = String(a.event_date).localeCompare(String(b.event_date));
      if (d !== 0) return d;
      return String(a.product).localeCompare(String(b.product));
    });

    return { sql, rows, count: rows.length, bytesProcessed, products };
  }

  /**
   * Monthly / Yearly / Lifetime subscription mix per registered product.
   */
  async compareSubscriptions(params = {}) {
    const results = await Promise.all(
      this.registry.productIds.map(async (id) => {
        const cfg = this.registry.configs[id];
        try {
          const result = await this.registry.repos[id].runDashboardQuery('subscription-tiers', {
            ...params,
            product: id,
          });
          return { label: cfg.label, result, error: null };
        } catch (e) {
          const msg = String(e?.message || e);
          console.error(`[compare] ${id} subscription-tiers failed: ${msg}`);
          return {
            label: cfg.label,
            result: {
              rows: [],
              sql: `-- ${cfg.label} subscription tiers failed: ${msg.replace(/\n/g, ' ')}`,
              bytesProcessed: 0,
            },
            error: msg,
          };
        }
      }),
    );

    const rows = results.flatMap(({ label, result }) =>
      (result.rows || []).map((r) => ({
        ...r,
        product: label,
      })),
    );
    const sql = results
      .map(({ label, result }) => `-- ===== ${label} subscription tiers =====\n${result.sql || ''}`)
      .join('\n\n');
    const bytesProcessed = results.reduce((s, x) => s + (x.result.bytesProcessed || 0), 0);
    const errors = results.filter((r) => r.error).map((r) => `${r.label}: ${r.error}`);

    if (errors.length && !rows.length) {
      throw new Error(`Subscription tier compare failed — ${errors.join(' · ')}`);
    }

    const tiers = ['Monthly', 'Yearly', 'Lifetime'];
    const summary = results.map(({ label, result }) => {
      const byTier = Object.fromEntries(
        (result.rows || []).map((r) => [r.subscription_tier, r]),
      );
      return {
        product: label,
        tiers: tiers.map((tier) => ({
          subscription_tier: tier,
          purchases: Number(byTier[tier]?.purchases || 0),
          paying_users: Number(byTier[tier]?.paying_users || 0),
          revenue_usd: Number(byTier[tier]?.revenue_usd || 0),
        })),
        source: result.source || 'raw',
      };
    });

    return {
      sql,
      rows,
      summary,
      count: rows.length,
      bytesProcessed,
      products: results.map((r) => r.label),
      source: 'raw',
      warnings: errors.length ? errors : undefined,
    };
  }

  /**
   * Fan out cohort LTV per product (same date/country/platform/channel filters).
   */
  async compareLtv(params = {}) {
    const results = await Promise.all(
      this.registry.productIds.map(async (id) => {
        const cfg = this.registry.configs[id];
        try {
          const result = await this.registry.repos[id].runDashboardQuery('ltv', {
            ...params,
            product: id,
            paginate: false,
          });
          return { label: cfg.label, result, error: null };
        } catch (e) {
          const msg = String(e?.message || e);
          console.error(`[compare] ${id} ltv failed: ${msg}`);
          return {
            label: cfg.label,
            result: {
              rows: [],
              sql: `-- ${cfg.label} LTV failed: ${msg.replace(/\n/g, ' ')}`,
              bytesProcessed: 0,
            },
            error: msg,
          };
        }
      }),
    );

    const rows = results.flatMap(({ label, result }) =>
      (result.rows || []).map((r) => ({
        ...r,
        product: label,
      })),
    );
    const sql = results
      .map(({ label, result }) => `-- ===== ${label} LTV =====\n${result.sql || ''}`)
      .join('\n\n');
    const bytesProcessed = results.reduce((s, x) => s + (x.result.bytesProcessed || 0), 0);
    const errors = results.filter((r) => r.error).map((r) => `${r.label}: ${r.error}`);

    if (errors.length && !rows.length) {
      throw new Error(`Cohort LTV compare failed — ${errors.join(' · ')}`);
    }

    // Pre-roll product totals so the Compare table never depends on client aggregation alone.
    const summary = results.map(({ label, result }) => {
      let r30 = 0;
      let i30 = 0;
      let r90 = 0;
      let i90 = 0;
      let r180 = 0;
      let i180 = 0;
      let installs = 0;
      for (const row of result.rows || []) {
        const inst = Number(row.installs || 0);
        installs += inst;
        const a30 = row.revenue_30 != null && Number.isFinite(Number(row.revenue_30))
          ? Number(row.revenue_30)
          : (row.ltv_30 != null && Number.isFinite(Number(row.ltv_30)) ? Number(row.ltv_30) * inst : null);
        const a90 = row.revenue_90 != null && Number.isFinite(Number(row.revenue_90))
          ? Number(row.revenue_90)
          : (row.ltv_90 != null && Number.isFinite(Number(row.ltv_90)) ? Number(row.ltv_90) * inst : null);
        const a180 = row.revenue_180 != null && Number.isFinite(Number(row.revenue_180))
          ? Number(row.revenue_180)
          : (row.ltv_180 != null && Number.isFinite(Number(row.ltv_180)) ? Number(row.ltv_180) * inst : null);
        if (a30 != null) {
          r30 += a30;
          i30 += inst;
        }
        if (a90 != null) {
          r90 += a90;
          i90 += inst;
        }
        if (a180 != null) {
          r180 += a180;
          i180 += inst;
        }
      }
      return {
        product: label,
        installs,
        ltv_30: i30 > 0 ? r30 / i30 : null,
        ltv_90: i90 > 0 ? r90 / i90 : null,
        ltv_180: i180 > 0 ? r180 / i180 : null,
        has_ltv_rows: (result.rows || []).length > 0,
        source: result.source || null,
      };
    });

    const productSources = summary.map((s) => s.source).filter(Boolean);
    const cheap = (s) => s === 'mongodb' || s === 'cohort_ltv' || s === 'summary';
    const source = !productSources.length
      ? null
      : productSources.every((s) => s === 'mongodb')
        ? 'mongodb'
        : productSources.every((s) => s === 'raw')
          ? 'raw'
          : productSources.every(cheap)
            ? 'mongodb'
            : 'mixed';

    return {
      sql,
      rows,
      summary,
      count: rows.length,
      bytesProcessed,
      products: results.map((r) => r.label),
      source,
      sources: summary.map((s) => ({ product: s.product, source: s.source })),
      warnings: errors.length ? errors : undefined,
    };
  }

  summarizeProduct(dailyRows, product) {
    if (!dailyRows.length) {
      return {
        product,
        dau: null,
        app_open_dau: null,
        notification_dau: null,
        any_event_dau: null,
        unique_users: 0,
        installs: 0,
        success_scans: 0,
        identification_success_rate: null,
        scans_per_user_day: null,
        free_quota_hit_rate: null,
        paywall_to_confirm_rate: null,
        open_to_success_rate: null,
        catalogue_open_rate: null,
        marketplace_engagement_rate: null,
        paying_users: 0,
      };
    }

    const latest = dailyRows[dailyRows.length - 1];
    const sum = (key) => dailyRows.reduce((s, r) => s + Number(r[key] || 0), 0);
    const avg = (key) => {
      const vals = dailyRows.map((r) => Number(r[key])).filter((n) => Number.isFinite(n));
      if (!vals.length) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };

    return {
      product,
      dau: Number(latest.app_open_dau ?? latest.dau ?? 0),
      app_open_dau: Number(latest.app_open_dau ?? latest.dau ?? 0),
      notification_dau: latest.notification_dau == null ? null : Number(latest.notification_dau),
      any_event_dau: latest.any_event_dau == null ? null : Number(latest.any_event_dau),
      unique_users: null,
      installs: sum('installs'),
      success_scans: sum('success_scans'),
      identification_success_rate: avg('identification_success_rate'),
      scans_per_user_day: avg('scans_per_dau'),
      free_quota_hit_rate: avg('free_quota_hit_rate'),
      paywall_to_confirm_rate: avg('paywall_to_confirm_rate'),
      open_to_success_rate: avg('open_to_success_rate'),
      catalogue_open_rate: avg('catalogue_open_rate'),
      marketplace_engagement_rate: avg('marketplace_engagement_rate'),
      paying_users: sum('paying_users'),
    };
  }

  listFunnels() {
    return listFunnels();
  }

  async getFunnel(funnelId, params = {}) {
    const product = this.resolveProduct(params);
    if (product === 'compare') {
      throw new Error('Select Banknote or Coinzy for funnel detail (not Compare)');
    }

    const mapped = getFunnelSteps(funnelId, product);
    if (!mapped) {
      throw new Error(`Unknown funnel: ${funnelId}`);
    }

    const start = params.start_date || daysAgo(params.days || 30);
    const end = params.end_date || today();
    const meta = {
      product,
      funnelId,
      title: mapped.funnel.title,
      description: mapped.funnel.description,
      start_date: start,
      end_date: end,
      status: mapped.status,
      message: mapped.message,
      identity: 'resolved_user_id = COALESCE(user_id, user_pseudo_id)',
      source: 'raw',
    };

    if (mapped.status !== 'ok') {
      return { ...meta, rows: [], count: 0, steps: [] };
    }

    const repo = this.registry.getRepo(product);
    const sql = buildFunnelSql(repo.project, repo.dataset, mapped.steps, start, end);
    const key = cacheKey(`${product}:funnel:v8:${funnelId}`, { start, end });

    return cached('funnel', key, async () => {
      const { rows, bytesProcessed } = await runQuery(repo.bigquery, sql);
      return {
        ...meta,
        sql,
        rows,
        count: rows.length,
        bytesProcessed,
        steps: mapped.steps.map((s) => ({
          id: s.id,
          label: s.label,
          events: s.events,
          core: Boolean(s.core),
          isDrop: Boolean(s.isDrop),
        })),
      };
    });
  }

  async listEvents(params = {}) {
    const product = this.resolveProduct(params);
    if (product === 'compare') {
      throw new Error('Select Banknote or Coinzy for event inventory');
    }
    const start = params.start_date || daysAgo(params.days || 30);
    const end = params.end_date || today();
    const search = params.search || '';
    const repo = this.registry.getRepo(product);
    const key = cacheKey(`${product}:event-inventory`, { start, end, search });

    return cached('inventory', key, async () => {
      if (!repo.preferRaw && repo.useSummary) {
        try {
          const sql = buildEventInventoryFromSummarySql(
            repo.project,
            repo.summaryDataset,
            start,
            end,
            search,
          );
          const { rows, bytesProcessed } = await runQuery(repo.bigquery, sql);
          return {
            product,
            start_date: start,
            end_date: end,
            search,
            source: 'summary',
            unique_users_note:
              'Summary unique_users is the peak daily distinct count in range (not range-distinct). Hits are exact.',
            sql,
            rows,
            count: rows.length,
            bytesProcessed,
          };
        } catch (e) {
          const msg = String(e?.message || e).toLowerCase();
          if (!msg.includes('not found') && !msg.includes('does not exist')) throw e;
        }
      }

      const sql = buildEventInventorySql(repo.project, repo.dataset, start, end, search);
      const { rows, bytesProcessed } = await runQuery(repo.bigquery, sql);
      return {
        product,
        start_date: start,
        end_date: end,
        search,
        source: 'raw',
        sql,
        rows,
        count: rows.length,
        bytesProcessed,
      };
    });
  }

  async getEventDetail(eventName, params = {}) {
    const product = this.resolveProduct(params);
    if (product === 'compare') {
      throw new Error('Select Banknote or Coinzy for event detail');
    }
    if (!eventName?.trim()) throw new Error('eventName is required');

    const start = params.start_date || daysAgo(params.days || 30);
    const end = params.end_date || today();
    const repo = this.registry.getRepo(product);
    const key = cacheKey(`${product}:event-detail`, { eventName, start, end });

    return cached('inventory', key, async () => {
      const dailySql = buildEventDailySql(repo.project, repo.dataset, eventName, start, end);
      const paramsSql = buildEventParamsSql(repo.project, repo.dataset, eventName, start, end);

      const [rolled, parameters] = await Promise.all([
        runQuery(repo.bigquery, dailySql),
        runQuery(repo.bigquery, paramsSql).catch(() => ({ rows: [], bytesProcessed: 0 })),
      ]);

      const totalRow = (rolled.rows || []).find((r) => r.event_date == null);
      const daily = (rolled.rows || []).filter((r) => r.event_date != null);
      const hits = Number(totalRow?.hits || daily.reduce((s, r) => s + Number(r.hits || 0), 0));
      const uniqueUsers = Number(totalRow?.unique_users || 0);

      return {
        product,
        event_name: eventName,
        start_date: start,
        end_date: end,
        source: 'raw',
        hits,
        unique_users: uniqueUsers,
        hits_per_user: uniqueUsers ? hits / uniqueUsers : null,
        unique_users_note:
          'Range unique_users is DISTINCT COALESCE(user_id, user_pseudo_id); daily unique_users are not additive across days',
        daily,
        parameters: parameters.rows,
        bytesProcessed: (rolled.bytesProcessed || 0) + (parameters.bytesProcessed || 0),
        sql: { daily: dailySql, parameters: paramsSql },
      };
    });
  }
}
