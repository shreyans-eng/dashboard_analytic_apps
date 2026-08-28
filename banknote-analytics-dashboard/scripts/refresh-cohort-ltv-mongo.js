#!/usr/bin/env node
/**
 * Cohort LTV → MongoDB refresh (BigQuery READ ONLY).
 *
 * Firebase events_* → SELECT aggregate → MongoDB collection `cohort_ltv`
 * Does NOT create BigQuery tables or touch analytics_summary.
 *
 * Usage:
 *   PRODUCTS=banknote,coinzy DAYS=30 LTV_DAYS=210 npm run refresh-ltv:mongo
 *   PRODUCT=coinzy START=2026-01-01 END=2026-08-24 npm run refresh-ltv:mongo
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BigQuery } from '@google-cloud/bigquery';
import { connectDb, closeDb, mongoConfigured } from '../server/db.js';
import { replaceCohortLtvWindow, ensureCohortLtvIndexes, countCohortLtv } from '../server/services/analytics/cohort-ltv-mongo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..');
const SQL_FILE = path.join(REPO, 'sql', 'scheduled', 'cohort_ltv_mongo.sql');

dotenv.config({ path: path.join(ROOT, '.env') });

const DEFAULTS = {
  banknote: {
    project: process.env.GCP_PROJECT || 'banknote-app-4f3fd',
    dataset: process.env.BQ_DATASET || 'analytics_488476338',
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  },
  coinzy: {
    project: process.env.COINZY_GCP_PROJECT || 'coinzy-26a4d',
    dataset: process.env.COINZY_BQ_DATASET || 'analytics_487601380',
    credentials: process.env.COINZY_GOOGLE_APPLICATION_CREDENTIALS,
  },
};

const LTV_LOOKBACK_DAYS = Number(process.env.LTV_DAYS || 210);

function resolveCred(rel) {
  if (!rel) return null;
  const p = path.isAbsolute(rel) ? rel : path.resolve(ROOT, rel);
  return fs.existsSync(p) ? p : null;
}

function parseDate(s) {
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${s}`);
  return d;
}

async function discoverBounds(bq, project, dataset) {
  const sql = `
    SELECT
      MIN(PARSE_DATE('%Y%m%d', REGEXP_EXTRACT(table_id, r'events_(\\d{8})'))) AS earliest,
      MAX(PARSE_DATE('%Y%m%d', REGEXP_EXTRACT(table_id, r'events_(\\d{8})'))) AS latest,
      COUNT(*) AS table_count
    FROM \`${project}.${dataset}.__TABLES__\`
    WHERE REGEXP_CONTAINS(table_id, r'^events_\\d{8}$')
  `;
  const [job] = await bq.createQueryJob({ query: sql, location: 'US' });
  const [rows] = await job.getQueryResults();
  const r = rows[0] || {};
  return {
    earliest: r.earliest?.value || r.earliest,
    latest: r.latest?.value || r.latest,
    tableCount: Number(r.table_count || 0),
  };
}

function buildSql(project, dataset, startSuffix, endSuffix) {
  let sql = fs.readFileSync(SQL_FILE, 'utf8');
  return sql
    .replace(/\{PROJECT\}/g, project)
    .replace(/\{DATASET\}/g, dataset)
    .replace(/\{START_SUFFIX\}/g, startSuffix)
    .replace(/\{END_SUFFIX\}/g, endSuffix);
}

function normalizeBqRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v && typeof v === 'object' && 'value' in v) out[k] = v.value;
    else out[k] = v;
  }
  return out;
}

async function refreshProduct(productId, opts) {
  const cfg = DEFAULTS[productId];
  if (!cfg) throw new Error(`Unknown product: ${productId}`);

  const keyFilename = resolveCred(cfg.credentials);
  if (!keyFilename) throw new Error(`[${productId}] credentials missing: ${cfg.credentials}`);

  const bq = new BigQuery({ projectId: cfg.project, keyFilename });
  console.log(`\n======== ${productId} LTV → MongoDB (BQ read ${cfg.project}.${cfg.dataset}) ========`);

  const bounds = await discoverBounds(bq, cfg.project, cfg.dataset);
  console.log(`  events_* tables: ${bounds.tableCount}, ${bounds.earliest} → ${bounds.latest}`);
  if (!bounds.earliest || !bounds.latest) {
    throw new Error(`[${productId}] no events_YYYYMMDD tables`);
  }

  let end = opts.end || bounds.latest;
  let start = opts.start || bounds.earliest;
  if (opts.days != null && !opts.start) {
    const endD = parseDate(end);
    const startD = new Date(endD);
    startD.setUTCDate(startD.getUTCDate() - (opts.days - 1));
    const earliestD = parseDate(bounds.earliest);
    start = (startD < earliestD ? earliestD : startD).toISOString().slice(0, 10);
    end = endD.toISOString().slice(0, 10);
  }

  // Expand lookback for LTV-180 unless explicit START=
  let cohortStart = start;
  if (!opts.start) {
    const endD = parseDate(end);
    const ltvStartD = new Date(endD);
    ltvStartD.setUTCDate(ltvStartD.getUTCDate() - (LTV_LOOKBACK_DAYS - 1));
    const earliestD = parseDate(bounds.earliest);
    const windowStartD = parseDate(start);
    const earlier = ltvStartD < windowStartD ? ltvStartD : windowStartD;
    cohortStart = (earlier < earliestD ? earliestD : earlier).toISOString().slice(0, 10);
  }

  const startSuffix = cohortStart.replace(/-/g, '');
  const endSuffix = end.replace(/-/g, '');
  console.log(`  cohort window: ${cohortStart} → ${end} (LTV_DAYS=${LTV_LOOKBACK_DAYS})`);

  const sql = buildSql(cfg.project, cfg.dataset, startSuffix, endSuffix);
  console.log('→ BigQuery SELECT (read-only)…');
  const [job] = await bq.createQueryJob({
    query: sql,
    location: 'US',
    useQueryCache: true,
    maximumBytesBilled: String(Number(process.env.BQ_MAX_BYTES_BILLED || 20 * 1024 * 1024 * 1024)),
  });
  const [rowsRaw] = await job.getQueryResults();
  const [metadata] = await job.getMetadata();
  const bytes = Number(metadata.statistics?.query?.totalBytesProcessed || 0);
  console.log(`  ✓ ${(bytes / 1e6).toFixed(1)} MB scanned, ${rowsRaw.length} aggregate rows`);

  const rows = rowsRaw.map(normalizeBqRow);
  const result = await replaceCohortLtvWindow(productId, rows, {
    windowStart: cohortStart,
    windowEnd: end,
    bytesProcessed: bytes,
  });
  const total = await countCohortLtv(productId);
  console.log(
    `  MongoDB: deleted ${result.deleted} in window, inserted ${result.inserted}, product total ${total}`,
  );

  return {
    productId,
    windowStart: cohortStart,
    windowEnd: end,
    bytes,
    inserted: result.inserted,
    deleted: result.deleted,
    mongoTotal: total,
  };
}

async function main() {
  if (!mongoConfigured()) {
    throw new Error('MONGODB_URI is required for LTV Mongo refresh');
  }
  await connectDb();
  await ensureCohortLtvIndexes();

  const productList = (process.env.PRODUCT || process.env.PRODUCTS || 'banknote,coinzy')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const days =
    process.env.DAYS != null && process.env.DAYS !== '' ? Number(process.env.DAYS) : 30;
  const start = process.env.START || null;
  const end = process.env.END || null;

  const ok = [];
  const failed = [];
  for (const id of productList) {
    try {
      ok.push(await refreshProduct(id, { days, start, end }));
    } catch (e) {
      console.error(`\n✗ ${id}: ${e.message}`);
      failed.push({ productId: id, error: String(e.message || e) });
    }
  }

  console.log('\nSummary:', JSON.stringify({ ok, failed }, null, 2));
  await closeDb();
  if (failed.length) process.exitCode = 1;
}

main().catch(async (e) => {
  console.error(e.message);
  try {
    await closeDb();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
