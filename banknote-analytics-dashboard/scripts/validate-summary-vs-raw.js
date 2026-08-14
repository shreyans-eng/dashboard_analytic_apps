#!/usr/bin/env node
/**
 * Validate summary vs raw for core KPIs on a product.
 *
 * Usage:
 *   PRODUCT=coinzy DAYS=7 node scripts/validate-summary-vs-raw.js
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BigQuery } from '@google-cloud/bigquery';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(ROOT, '.env') });

const BUILTIN = {
  banknote: {
    project: process.env.GCP_PROJECT || 'banknote-app-4f3fd',
    dataset: process.env.BQ_DATASET || 'analytics_488476338',
    summary: process.env.BQ_SUMMARY_DATASET || 'analytics_summary',
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  },
  coinzy: {
    project: process.env.COINZY_GCP_PROJECT || 'coinzy-26a4d',
    dataset: process.env.COINZY_BQ_DATASET || 'analytics_487601380',
    summary: process.env.COINZY_BQ_SUMMARY_DATASET || 'analytics_summary',
    credentials: process.env.COINZY_GOOGLE_APPLICATION_CREDENTIALS,
  },
};

function resolveCred(rel) {
  const p = path.isAbsolute(rel) ? rel : path.resolve(ROOT, rel);
  return fs.existsSync(p) ? p : null;
}

async function q(bq, sql) {
  const [job] = await bq.createQueryJob({ query: sql, location: 'US' });
  const [rows] = await job.getQueryResults();
  return rows.map((r) => {
    const o = {};
    for (const [k, v] of Object.entries(r)) o[k] = v?.value ?? v;
    return o;
  });
}

async function main() {
  const productId = (process.env.PRODUCT || 'coinzy').toLowerCase();
  const days = Number(process.env.DAYS || 7);
  const cfg = BUILTIN[productId];
  const keyFilename = resolveCred(cfg.credentials);
  if (!keyFilename) throw new Error('Missing credentials');

  const bq = new BigQuery({ projectId: cfg.project, keyFilename });
  const P = cfg.project;
  const D = cfg.dataset;
  const S = cfg.summary;

  const bounds = (
    await q(
      bq,
      `SELECT MAX(PARSE_DATE('%Y%m%d', REGEXP_EXTRACT(table_id, r'events_(\\d{8})'))) AS latest
       FROM \`${P}.${D}.__TABLES__\` WHERE REGEXP_CONTAINS(table_id, r'^events_\\d{8}$')`,
    )
  )[0];
  const end = bounds.latest;
  const endD = new Date(`${end}T00:00:00Z`);
  const startD = new Date(endD);
  startD.setUTCDate(startD.getUTCDate() - (days - 1));
  const start = startD.toISOString().slice(0, 10);
  const startS = start.replace(/-/g, '');
  const endS = end.replace(/-/g, '');

  console.log(`Validate ${productId} ${start} → ${end}`);

  const rawDau = await q(
    bq,
    `
    SELECT event_date, COUNT(DISTINCT resolved_user_id) AS dau
    FROM (
      SELECT
        PARSE_DATE('%Y%m%d', event_date) AS event_date,
        COALESCE(
          user_id,
          (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'user_id'),
          user_pseudo_id
        ) AS resolved_user_id
      FROM \`${P}.${D}.events_*\`
      WHERE _TABLE_SUFFIX BETWEEN '${startS}' AND '${endS}'
        AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\\d{8}$')
    )
    GROUP BY event_date ORDER BY event_date
  `,
  );

  let summaryDau = [];
  try {
    summaryDau = await q(
      bq,
      `
      SELECT event_date, dau
      FROM \`${P}.${S}.product_daily_signals\`
      WHERE event_date BETWEEN '${start}' AND '${end}'
      ORDER BY event_date
    `,
    );
  } catch (e) {
    console.error('SUMMARY MISSING product_daily_signals:', e.message);
    process.exit(2);
  }

  const map = new Map(summaryDau.map((r) => [String(r.event_date), Number(r.dau)]));
  let mismatches = 0;
  for (const r of rawDau) {
    const s = map.get(String(r.event_date));
    const raw = Number(r.dau);
    const ok = s === raw;
    if (!ok) mismatches += 1;
    console.log(`${r.event_date} raw=${raw} summary=${s} ${ok ? 'OK' : 'DIFF'}`);
  }

  // Signals vs raw for one day (latest)
  const signalsSum = await q(
    bq,
    `SELECT * FROM \`${P}.${S}.product_daily_signals\`
     WHERE event_date = '${end}'`,
  ).catch((e) => {
    console.warn('product_daily_signals missing:', e.message);
    return [];
  });

  console.log('\nproduct_daily_signals latest:', signalsSum[0] || null);
  console.log(`\nDAU mismatches: ${mismatches}/${rawDau.length}`);
  if (mismatches > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
