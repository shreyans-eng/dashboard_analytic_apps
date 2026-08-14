/** Tracks BigQuery bytes scanned per UTC day for cost monitoring */

let bytesToday = 0;
let queryCountToday = 0;
let dayKey = utcDayKey();

function utcDayKey() {
  return new Date().toISOString().slice(0, 10);
}

function resetIfNewDay() {
  const today = utcDayKey();
  if (today !== dayKey) {
    dayKey = today;
    bytesToday = 0;
    queryCountToday = 0;
  }
}

export function recordQuery(bytesProcessed = 0) {
  resetIfNewDay();
  bytesToday += Number(bytesProcessed) || 0;
  queryCountToday += 1;
}

export function getMetrics() {
  resetIfNewDay();
  return {
    date: dayKey,
    bytesProcessedToday: bytesToday,
    gbProcessedToday: +(bytesToday / 1e9).toFixed(4),
    queryCountToday,
  };
}
