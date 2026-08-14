/** Detect whether Firebase intraday export tables exist */

let cached = null;
let cachedAt = 0;
const CACHE_MS = 60 * 60 * 1000; // re-check hourly

export async function detectIntraday(bigquery, project, dataset) {
  const now = Date.now();
  if (cached !== null && now - cachedAt < CACHE_MS) {
    return cached;
  }

  try {
    const sql = `
      SELECT COUNT(*) AS cnt
      FROM \`${project}.${dataset}.INFORMATION_SCHEMA.TABLES\`
      WHERE table_name LIKE 'events_intraday_%'
      LIMIT 1
    `;
    const [job] = await bigquery.createQueryJob({ query: sql, location: 'US' });
    const [rows] = await job.getQueryResults();
    cached = Number(rows[0]?.cnt || 0) > 0;
    cachedAt = now;
  } catch {
    cached = false;
    cachedAt = now;
  }
  return cached;
}

export function getIntradayStatus() {
  return { intradayEnabled: cached ?? false, checkedAt: cachedAt ? new Date(cachedAt).toISOString() : null };
}

export function resetIntradayCache() {
  cached = null;
  cachedAt = 0;
}
