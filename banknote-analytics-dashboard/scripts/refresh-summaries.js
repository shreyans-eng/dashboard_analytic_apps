#!/usr/bin/env node
/**
 * Create summary tables (if missing) and refresh from views.
 * Run daily via cron / Cloud Scheduler after Firebase → BigQuery export lands.
 *
 * Usage:
 *   cd banknote-analytics-dashboard && node scripts/refresh-summaries.js
 *   PROJECT=banknote-app-4f3fd DATASET=analytics_488476338 node scripts/refresh-summaries.js
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BigQuery } from '@google-cloud/bigquery';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SQL_ROOT = path.resolve(ROOT, '..', 'sql', 'summary');

dotenv.config({ path: path.join(ROOT, '.env') });

const PROJECT = process.env.GCP_PROJECT || 'banknote-app-4f3fd';
const DATASET = process.env.BQ_DATASET || 'analytics_488476338';

function resolveCredentials() {
  const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!creds) return;
  const resolved = path.isAbsolute(creds) ? creds : path.resolve(ROOT, creds);
  if (fs.existsSync(resolved)) process.env.GOOGLE_APPLICATION_CREDENTIALS = resolved;
}

function substitute(sql) {
  return sql.replace(/\{PROJECT\}/g, PROJECT).replace(/\{DATASET\}/g, DATASET);
}

async function runSql(bigquery, sql, label) {
  const query = substitute(sql);
  console.log(`→ ${label}`);
  const [job] = await bigquery.createQueryJob({ query, location: 'US' });
  await job.getQueryResults();
  const [metadata] = await job.getMetadata();
  const bytes = Number(metadata.statistics?.query?.totalBytesProcessed || 0);
  console.log(`  ✓ ${label} (${(bytes / 1e6).toFixed(1)} MB scanned)`);
  return bytes;
}

async function main() {
  resolveCredentials();
  const bigquery = new BigQuery({ projectId: PROJECT });
  let totalBytes = 0;

  const createFiles = fs.readdirSync(SQL_ROOT)
    .filter((f) => /^\d{2}_summary/.test(f))
    .sort();

  for (const file of createFiles) {
    const sql = fs.readFileSync(path.join(SQL_ROOT, file), 'utf8');
    totalBytes += await runSql(bigquery, sql, `CREATE ${file}`);
  }

  const refreshFiles = fs.readdirSync(SQL_ROOT)
    .filter((f) => f.startsWith('refresh_'))
    .sort();

  for (const file of refreshFiles) {
    const sql = fs.readFileSync(path.join(SQL_ROOT, file), 'utf8');
    totalBytes += await runSql(bigquery, sql, `REFRESH ${file}`);
  }

  console.log(`\nDone. Total bytes processed: ${(totalBytes / 1e9).toFixed(3)} GB`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
