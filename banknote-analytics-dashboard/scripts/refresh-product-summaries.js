#!/usr/bin/env node
/**
 * Multi-product summary refresh from raw events_* (idempotent window refresh).
 *
 * Does NOT mutate Firebase raw tables.
 * Prefer sql/scheduled/*.sql which materialize into analytics_summary.
 *
 * Usage:
 *   PRODUCT=coinzy node scripts/refresh-product-summaries.js
 *   PRODUCT=banknote DAYS=90 node scripts/refresh-product-summaries.js
 *   PRODUCT=coinzy START=2025-06-21 END=2026-08-11 INCLUDE_INVENTORY=1 node scripts/refresh-product-summaries.js
 *   PRODUCTS=banknote,coinzy DAYS=30 node scripts/refresh-product-summaries.js
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BigQuery } from '@google-cloud/bigquery';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..');
const SQL_SCHEDULED = path.join(REPO, 'sql', 'scheduled');

dotenv.config({ path: path.join(ROOT, '.env') });

const DEFAULTS = {
  banknote: {
    project: process.env.GCP_PROJECT || 'banknote-app-4f3fd',
    dataset: process.env.BQ_DATASET || 'analytics_488476338',
    summaryDataset: process.env.BQ_SUMMARY_DATASET || 'analytics_summary',
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  },
  coinzy: {
    project: process.env.COINZY_GCP_PROJECT || 'coinzy-26a4d',
    dataset: process.env.COINZY_BQ_DATASET || 'analytics_487601380',
    summaryDataset: process.env.COINZY_BQ_SUMMARY_DATASET || 'analytics_summary',
    credentials: process.env.COINZY_GOOGLE_APPLICATION_CREDENTIALS,
  },
};

const CORE_FILES = [
  'daily_active_users.sql',
  'monthly_active_users.sql',
  'daily_new_users.sql',
  'daily_retention.sql',
  'country_metrics.sql',
  'platform_metrics.sql',
  'top_events.sql',
  'product_daily_signals.sql',
];

function resolveCred(rel) {
  if (!rel) return null;
  const p = path.isAbsolute(rel) ? rel : path.resolve(ROOT, rel);
  return fs.existsSync(p) ? p : null;
}

function yyyymmdd(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function parseDate(s) {
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${s}`);
  return d;
}

async function ensureSummaryDataset(bq, project, summaryDataset) {
  try {
    await bq.createDataset(summaryDataset, { location: 'US' });
    console.log(`  dataset ${project}.${summaryDataset}: created`);
  } catch (e) {
    if (e.code === 409 || /Already Exists/i.test(e.message)) {
      console.log(`  dataset ${project}.${summaryDataset}: exists`);
    } else {
      throw e;
    }
  }
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

function substituteSql(raw, { project, dataset, summaryDataset, startSuffix, endSuffix }) {
  const startDate = `${startSuffix.slice(0, 4)}-${startSuffix.slice(4, 6)}-${startSuffix.slice(6, 8)}`;
  const endDate = `${endSuffix.slice(0, 4)}-${endSuffix.slice(4, 6)}-${endSuffix.slice(6, 8)}`;

  let sql = raw
    .replace(/\{PROJECT\}/g, project)
    .replace(/\{DATASET\}/g, dataset)
    .replace(/\{SUMMARY_DATASET\}/g, summaryDataset)
    .replace(/\{START_SUFFIX\}/g, startSuffix)
    .replace(/\{END_SUFFIX\}/g, endSuffix)
    .replace(/\{START_DATE\}/g, startDate)
    .replace(/\{END_DATE\}/g, endDate);

  sql = sql.replaceAll(`${project}.analytics_summary`, `${project}.${summaryDataset}`);

  if (!raw.includes('{START_SUFFIX}') && !raw.includes('{START_DATE}')) {
    // Table suffix windows
    sql = sql.replace(
      /_TABLE_SUFFIX\s+BETWEEN\s+FORMAT_DATE\('%Y%m%d',\s*DATE_SUB\(CURRENT_DATE\(\),\s*INTERVAL\s+\d+\s+DAY\)\)\s*AND\s+FORMAT_DATE\('%Y%m%d',\s*CURRENT_DATE\(\)\)/g,
      `_TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'`,
    );
    sql = sql.replace(
      /_TABLE_SUFFIX\s+BETWEEN\s+FORMAT_DATE\('%Y%m%d',\s*DATE_TRUNC\(DATE_SUB\(CURRENT_DATE\(\),\s*INTERVAL\s+\d+\s+MONTH\),\s*MONTH\)\)\s*AND\s+FORMAT_DATE\('%Y%m%d',\s*CURRENT_DATE\(\)\)/g,
      `_TABLE_SUFFIX BETWEEN '${startSuffix}' AND '${endSuffix}'`,
    );

    // DELETE / filter windows on event_date / cohort_date / activity_month
    sql = sql.replace(
      /(event_date|cohort_date)\s*>=\s*DATE_SUB\(CURRENT_DATE\(\),\s*INTERVAL\s+\d+\s+DAY\)/g,
      `$1 >= DATE '${startDate}'`,
    );
    sql = sql.replace(
      /activity_month\s*>=\s*DATE_TRUNC\(DATE_SUB\(CURRENT_DATE\(\),\s*INTERVAL\s+\d+\s+MONTH\),\s*MONTH\)/g,
      `activity_month >= DATE_TRUNC(DATE '${startDate}', MONTH)`,
    );
  }

  return sql;
}

async function runSql(bq, sql, label) {
  console.log(`→ ${label}`);
  const [job] = await bq.createQueryJob({ query: sql, location: 'US' });
  await job.getQueryResults();
  const [metadata] = await job.getMetadata();
  const bytes = Number(metadata.statistics?.query?.totalBytesProcessed || 0);
  console.log(`  ✓ ${(bytes / 1e6).toFixed(1)} MB scanned`);
  return bytes;
}

async function refreshProduct(productId, opts) {
  const cfg = DEFAULTS[productId];
  if (!cfg) throw new Error(`Unknown product: ${productId}. Add defaults or use env.`);

  const keyFilename = resolveCred(cfg.credentials);
  if (!keyFilename) {
    throw new Error(`[${productId}] credentials file missing: ${cfg.credentials}`);
  }

  const bq = new BigQuery({ projectId: cfg.project, keyFilename });
  console.log(`\n======== ${productId} → ${cfg.project}.${cfg.summaryDataset} ========`);

  await ensureSummaryDataset(bq, cfg.project, cfg.summaryDataset);

  const bounds = await discoverBounds(bq, cfg.project, cfg.dataset);
  console.log(
    `  raw events_* tables: ${bounds.tableCount}, range ${bounds.earliest} → ${bounds.latest}`,
  );
  if (!bounds.earliest || !bounds.latest) {
    throw new Error(`[${productId}] no events_YYYYMMDD tables found`);
  }

  let start = opts.start || bounds.earliest;
  let end = opts.end || bounds.latest;
  if (opts.days != null) {
    const endD = parseDate(end);
    const startD = new Date(endD);
    startD.setUTCDate(startD.getUTCDate() - (opts.days - 1));
    const earliestD = parseDate(bounds.earliest);
    start = yyyymmdd(startD < earliestD ? earliestD : startD).replace(
      /(\d{4})(\d{2})(\d{2})/,
      '$1-$2-$3',
    );
    // keep ISO dates
    start = (startD < earliestD ? earliestD : startD).toISOString().slice(0, 10);
    end = endD.toISOString().slice(0, 10);
  }

  const startSuffix = start.replace(/-/g, '');
  const endSuffix = end.replace(/-/g, '');
  console.log(`  refresh window: ${start} → ${end} (${startSuffix}–${endSuffix})`);

  const files = [...CORE_FILES];
  if (opts.includeInventory) files.push('event_inventory_daily.sql');

  let totalBytes = 0;
  for (const file of files) {
    const full = path.join(SQL_SCHEDULED, file);
    if (!fs.existsSync(full)) {
      console.warn(`  skip missing ${file}`);
      continue;
    }
    const raw = fs.readFileSync(full, 'utf8');
    const sql = substituteSql(raw, {
      project: cfg.project,
      dataset: cfg.dataset,
      summaryDataset: cfg.summaryDataset,
      startSuffix,
      endSuffix,
      days: opts.days,
    });
    try {
      totalBytes += await runSql(bq, sql, file);
    } catch (e) {
      console.error(`  ✗ ${file}: ${e.message}`);
      throw e;
    }
  }

  console.log(`Done ${productId}. ${(totalBytes / 1e9).toFixed(3)} GB scanned.`);
  return { productId, start, end, tableCount: bounds.tableCount, bytes: totalBytes };
}

async function main() {
  const productList = (
    process.env.PRODUCT ||
    process.env.PRODUCTS ||
    'coinzy'
  )
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const days = process.env.DAYS != null && process.env.DAYS !== ''
    ? Number(process.env.DAYS)
    : null;
  const start = process.env.START || null;
  const end = process.env.END || null;
  const includeInventory = ['1', 'true', 'yes'].includes(
    String(process.env.INCLUDE_INVENTORY || '').toLowerCase(),
  );

  const results = [];
  for (const id of productList) {
    results.push(await refreshProduct(id, { days, start, end, includeInventory }));
  }
  console.log('\nSummary:', JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
