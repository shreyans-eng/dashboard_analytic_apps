import { BigQuery } from '@google-cloud/bigquery';
import { recordQuery } from './metrics-tracker.js';

export function createBigQueryClient(projectId, keyFilename) {
  const opts = { projectId };
  if (keyFilename) opts.keyFilename = keyFilename;
  return new BigQuery(opts);
}

function normalizeRow(row) {
  const out = {};
  for (const [key, val] of Object.entries(row)) {
    if (val && typeof val === 'object' && 'value' in val) {
      out[key] = val.value;
    } else if (val instanceof Date) {
      out[key] = val.toISOString().slice(0, 10);
    } else {
      out[key] = val;
    }
  }
  return out;
}

export async function runQuery(bigquery, sql) {
  const maxBytes = Number(process.env.BQ_MAX_BYTES_BILLED || 20 * 1024 * 1024 * 1024);
  const [job] = await bigquery.createQueryJob({
    query: sql,
    location: 'US',
    useQueryCache: true,
    maximumBytesBilled: String(Math.max(1, maxBytes)),
  });
  const [rows] = await job.getQueryResults();
  const [metadata] = await job.getMetadata();
  const bytesProcessed = Number(metadata.statistics?.query?.totalBytesProcessed || 0);
  recordQuery(bytesProcessed);
  return { rows: rows.map(normalizeRow), bytesProcessed };
}
