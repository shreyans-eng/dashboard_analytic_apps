/**
 * MongoDB read-model for Cohort LTV (aggregated only — never raw events).
 * Collection: cohort_ltv
 * Unique: product + cohort_date + country + install_channel + platform
 */

import { ensureDb, getDb, mongoConfigured } from '../../db.js';

export const COHORT_LTV_COLLECTION = 'cohort_ltv';

const CHANNELS = new Set(['Organic', 'Paid', 'Direct']);

let indexesReady = false;

export function cohortLtvMongoReady() {
  return mongoConfigured();
}

function col() {
  return getDb().collection(COHORT_LTV_COLLECTION);
}

export async function ensureCohortLtvIndexes() {
  await ensureDb();
  if (indexesReady) return;
  const c = col();
  await c.createIndex(
    { product: 1, cohort_date: 1, country: 1, install_channel: 1, platform: 1 },
    { unique: true, name: 'uniq_product_cohort_dims' },
  );
  await c.createIndex({ product: 1, cohort_date: 1 }, { name: 'product_cohort_date' });
  await c.createIndex(
    { product: 1, country: 1, install_channel: 1, cohort_date: 1 },
    { name: 'product_filters' },
  );
  await c.createIndex({ product: 1, updated_at: -1 }, { name: 'product_updated' });
  indexesReady = true;
}

function toDateString(v) {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object' && v.value) return String(v.value).slice(0, 10);
  return String(v).slice(0, 10);
}

function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function normalizeLtvRow(productId, row, meta = {}) {
  const cohortDate = toDateString(row.cohort_date);
  return {
    product: productId,
    cohort_date: cohortDate,
    country: String(row.country || 'Unknown'),
    install_channel: String(row.install_channel || 'Direct'),
    platform: String(row.platform || '').toLowerCase() || null,
    installs: Number(row.installs || 0),
    revenue_30: numOrNull(row.revenue_30),
    revenue_90: numOrNull(row.revenue_90),
    revenue_180: numOrNull(row.revenue_180),
    ltv_30: numOrNull(row.ltv_30),
    ltv_90: numOrNull(row.ltv_90),
    ltv_180: numOrNull(row.ltv_180),
    payers_30: numOrNull(row.payers_30),
    payers_90: numOrNull(row.payers_90),
    payers_180: numOrNull(row.payers_180),
    paid_rate_30: numOrNull(row.paid_rate_30),
    paid_rate_90: numOrNull(row.paid_rate_90),
    paid_rate_180: numOrNull(row.paid_rate_180),
    updated_at: meta.updatedAt || new Date(),
    refresh_window_start: meta.windowStart || null,
    refresh_window_end: meta.windowEnd || null,
    bytes_processed: meta.bytesProcessed ?? null,
  };
}

/**
 * Idempotent window replace: delete product docs in [start,end], then insert.
 */
export async function replaceCohortLtvWindow(productId, rows, { windowStart, windowEnd, bytesProcessed }) {
  await ensureCohortLtvIndexes();
  const c = col();
  const updatedAt = new Date();
  const docs = rows.map((r) =>
    normalizeLtvRow(productId, r, { updatedAt, windowStart, windowEnd, bytesProcessed }),
  );

  const del = await c.deleteMany({
    product: productId,
    cohort_date: { $gte: windowStart, $lte: windowEnd },
  });

  if (docs.length) {
    await c.insertMany(docs, { ordered: false });
  }

  return {
    productId,
    deleted: del.deletedCount,
    inserted: docs.length,
    windowStart,
    windowEnd,
    updatedAt,
  };
}

export async function countCohortLtv(productId) {
  await ensureDb();
  return col().countDocuments({ product: productId });
}

export async function latestCohortLtvRefresh(productId) {
  await ensureDb();
  const doc = await col().find({ product: productId }).sort({ updated_at: -1 }).limit(1).next();
  return doc?.updated_at || null;
}

function buildMatch(productId, params = {}) {
  const match = { product: productId };
  const start = toDateString(params.start_date);
  const end = toDateString(params.end_date);
  if (start && end) match.cohort_date = { $gte: start, $lte: end };
  else if (start) match.cohort_date = { $gte: start };
  else if (end) match.cohort_date = { $lte: end };

  if (params.country) match.country = String(params.country);
  if (params.platform) match.platform = String(params.platform).toLowerCase();
  if (params.install_channel && CHANNELS.has(String(params.install_channel))) {
    match.install_channel = String(params.install_channel);
  }

  const search = String(params.search || params.q || '').trim();
  if (search) {
    const re = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    match.$or = [{ country: re }, { install_channel: re }, { cohort_date: re }];
  }
  return match;
}

/** Roll platform up; recompute LTV from revenue ÷ mature installs. */
function rollupGroupStage() {
  return {
    $group: {
      _id: {
        cohort_date: '$cohort_date',
        country: '$country',
        install_channel: '$install_channel',
      },
      installs: { $sum: '$installs' },
      rev30: {
        $sum: { $cond: [{ $ne: ['$revenue_30', null] }, '$revenue_30', 0] },
      },
      inst30: {
        $sum: { $cond: [{ $ne: ['$revenue_30', null] }, '$installs', 0] },
      },
      rev90: {
        $sum: { $cond: [{ $ne: ['$revenue_90', null] }, '$revenue_90', 0] },
      },
      inst90: {
        $sum: { $cond: [{ $ne: ['$revenue_90', null] }, '$installs', 0] },
      },
      rev180: {
        $sum: { $cond: [{ $ne: ['$revenue_180', null] }, '$revenue_180', 0] },
      },
      inst180: {
        $sum: { $cond: [{ $ne: ['$revenue_180', null] }, '$installs', 0] },
      },
      payers_30: {
        $sum: { $cond: [{ $ne: ['$payers_30', null] }, '$payers_30', 0] },
      },
      payers_90: {
        $sum: { $cond: [{ $ne: ['$payers_90', null] }, '$payers_90', 0] },
      },
      payers_180: {
        $sum: { $cond: [{ $ne: ['$payers_180', null] }, '$payers_180', 0] },
      },
      has30: { $max: { $cond: [{ $ne: ['$revenue_30', null] }, 1, 0] } },
      has90: { $max: { $cond: [{ $ne: ['$revenue_90', null] }, 1, 0] } },
      has180: { $max: { $cond: [{ $ne: ['$revenue_180', null] }, 1, 0] } },
      updated_at: { $max: '$updated_at' },
    },
  };
}

function projectRolledStage() {
  return {
    $project: {
      _id: 0,
      cohort_date: '$_id.cohort_date',
      country: '$_id.country',
      install_channel: '$_id.install_channel',
      installs: 1,
      revenue_30: { $cond: [{ $eq: ['$has30', 1] }, '$rev30', null] },
      revenue_90: { $cond: [{ $eq: ['$has90', 1] }, '$rev90', null] },
      revenue_180: { $cond: [{ $eq: ['$has180', 1] }, '$rev180', null] },
      ltv_30: {
        $cond: [
          { $and: [{ $eq: ['$has30', 1] }, { $gt: ['$inst30', 0] }] },
          { $divide: ['$rev30', '$inst30'] },
          null,
        ],
      },
      ltv_90: {
        $cond: [
          { $and: [{ $eq: ['$has90', 1] }, { $gt: ['$inst90', 0] }] },
          { $divide: ['$rev90', '$inst90'] },
          null,
        ],
      },
      ltv_180: {
        $cond: [
          { $and: [{ $eq: ['$has180', 1] }, { $gt: ['$inst180', 0] }] },
          { $divide: ['$rev180', '$inst180'] },
          null,
        ],
      },
      payers_30: { $cond: [{ $eq: ['$has30', 1] }, '$payers_30', null] },
      payers_90: { $cond: [{ $eq: ['$has90', 1] }, '$payers_90', null] },
      payers_180: { $cond: [{ $eq: ['$has180', 1] }, '$payers_180', null] },
      paid_rate_30: {
        $cond: [
          { $and: [{ $eq: ['$has30', 1] }, { $gt: ['$inst30', 0] }] },
          { $divide: ['$payers_30', '$inst30'] },
          null,
        ],
      },
      paid_rate_90: {
        $cond: [
          { $and: [{ $eq: ['$has90', 1] }, { $gt: ['$inst90', 0] }] },
          { $divide: ['$payers_90', '$inst90'] },
          null,
        ],
      },
      paid_rate_180: {
        $cond: [
          { $and: [{ $eq: ['$has180', 1] }, { $gt: ['$inst180', 0] }] },
          { $divide: ['$payers_180', '$inst180'] },
          null,
        ],
      },
      updated_at: 1,
    },
  };
}

function parsePage(params) {
  const disable =
    params.paginate === false ||
    params.paginate === 'false' ||
    params.page_size === 'all' ||
    params.limit === 'all';
  if (disable) return { paginate: false, page: 0, pageSize: 0, skip: 0 };

  const pageSize = Math.min(
    500,
    Math.max(1, Number(params.page_size || params.limit || 25) || 25),
  );
  const page = Math.max(0, Number(params.page ?? 0) || 0);
  return { paginate: true, page, pageSize, skip: page * pageSize };
}

/**
 * Filtered LTV read from Mongo — no BigQuery.
 * Returns paginated detail rows + chart aggregates over the full filter set.
 */
export async function queryCohortLtv(productId, params = {}) {
  await ensureCohortLtvIndexes();
  const match = buildMatch(productId, params);
  const { paginate, page, pageSize, skip } = parsePage(params);

  const base = [{ $match: match }, rollupGroupStage(), projectRolledStage()];

  const facet = {
    $facet: {
      total: [{ $count: 'n' }],
      rows: [
        { $sort: { cohort_date: 1, country: 1, install_channel: 1 } },
        ...(paginate ? [{ $skip: skip }, { $limit: pageSize }] : []),
      ],
      daily: [
        {
          $group: {
            _id: '$cohort_date',
            installs: { $sum: '$installs' },
            rev30: { $sum: { $cond: [{ $ne: ['$revenue_30', null] }, '$revenue_30', 0] } },
            inst30: { $sum: { $cond: [{ $ne: ['$revenue_30', null] }, '$installs', 0] } },
            rev90: { $sum: { $cond: [{ $ne: ['$revenue_90', null] }, '$revenue_90', 0] } },
            inst90: { $sum: { $cond: [{ $ne: ['$revenue_90', null] }, '$installs', 0] } },
            rev180: { $sum: { $cond: [{ $ne: ['$revenue_180', null] }, '$revenue_180', 0] } },
            inst180: { $sum: { $cond: [{ $ne: ['$revenue_180', null] }, '$installs', 0] } },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            event_date: '$_id',
            installs: 1,
            ltv_30: {
              $cond: [{ $gt: ['$inst30', 0] }, { $divide: ['$rev30', '$inst30'] }, null],
            },
            ltv_90: {
              $cond: [{ $gt: ['$inst90', 0] }, { $divide: ['$rev90', '$inst90'] }, null],
            },
            ltv_180: {
              $cond: [{ $gt: ['$inst180', 0] }, { $divide: ['$rev180', '$inst180'] }, null],
            },
          },
        },
      ],
      by_channel: [
        {
          $group: {
            _id: '$install_channel',
            installs: { $sum: '$installs' },
            rev30: { $sum: { $cond: [{ $ne: ['$revenue_30', null] }, '$revenue_30', 0] } },
            inst30: { $sum: { $cond: [{ $ne: ['$revenue_30', null] }, '$installs', 0] } },
            rev90: { $sum: { $cond: [{ $ne: ['$revenue_90', null] }, '$revenue_90', 0] } },
            inst90: { $sum: { $cond: [{ $ne: ['$revenue_90', null] }, '$installs', 0] } },
            rev180: { $sum: { $cond: [{ $ne: ['$revenue_180', null] }, '$revenue_180', 0] } },
            inst180: { $sum: { $cond: [{ $ne: ['$revenue_180', null] }, '$installs', 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            channel: '$_id',
            installs: 1,
            ltv_30: {
              $cond: [{ $gt: ['$inst30', 0] }, { $divide: ['$rev30', '$inst30'] }, null],
            },
            ltv_90: {
              $cond: [{ $gt: ['$inst90', 0] }, { $divide: ['$rev90', '$inst90'] }, null],
            },
            ltv_180: {
              $cond: [{ $gt: ['$inst180', 0] }, { $divide: ['$rev180', '$inst180'] }, null],
            },
          },
        },
      ],
      totals: [
        {
          $group: {
            _id: null,
            installs: { $sum: '$installs' },
            rev30: { $sum: { $cond: [{ $ne: ['$revenue_30', null] }, '$revenue_30', 0] } },
            inst30: { $sum: { $cond: [{ $ne: ['$revenue_30', null] }, '$installs', 0] } },
            rev90: { $sum: { $cond: [{ $ne: ['$revenue_90', null] }, '$revenue_90', 0] } },
            inst90: { $sum: { $cond: [{ $ne: ['$revenue_90', null] }, '$installs', 0] } },
            rev180: { $sum: { $cond: [{ $ne: ['$revenue_180', null] }, '$revenue_180', 0] } },
            inst180: { $sum: { $cond: [{ $ne: ['$revenue_180', null] }, '$installs', 0] } },
            updated_at: { $max: '$updated_at' },
          },
        },
      ],
      countries: [
        { $group: { _id: '$country' } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, country: '$_id' } },
      ],
    },
  };

  const [out] = await col().aggregate([...base, facet], { allowDiskUse: true }).toArray();
  const total = out.total[0]?.n || 0;
  const t = out.totals[0];
  const totals = t
    ? {
        installs: t.installs,
        ltv_30: t.inst30 ? t.rev30 / t.inst30 : null,
        ltv_90: t.inst90 ? t.rev90 / t.inst90 : null,
        ltv_180: t.inst180 ? t.rev180 / t.inst180 : null,
        updated_at: t.updated_at,
      }
    : { installs: 0, ltv_30: null, ltv_90: null, ltv_180: null, updated_at: null };

  const channelOrder = ['Organic', 'Paid', 'Direct'];
  const byChannelMap = new Map(out.by_channel.map((r) => [r.channel, r]));
  const by_channel = channelOrder.map(
    (ch) => byChannelMap.get(ch) || { channel: ch, installs: 0, ltv_30: null, ltv_90: null, ltv_180: null },
  );

  return {
    rows: out.rows,
    count: out.rows.length,
    total,
    page: paginate ? page : 0,
    page_size: paginate ? pageSize : total,
    page_count: paginate ? Math.max(1, Math.ceil(total / pageSize)) : 1,
    daily: out.daily,
    by_channel,
    totals,
    countries: out.countries.map((c) => c.country).filter(Boolean),
    source: 'mongodb',
    product: productId,
    bytesProcessed: 0,
    sql: `-- MongoDB ${COHORT_LTV_COLLECTION} filter product=${productId}`,
    refreshed_at: totals.updated_at,
  };
}
