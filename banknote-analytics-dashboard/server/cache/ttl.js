/** Cache TTL presets (milliseconds) — aligned with Firebase daily export cadence */

export const TTL = {
  DAILY: 24 * 60 * 60 * 1000,      // DAU, MAU, new users, MVP, funnels
  COUNTRY: 24 * 60 * 60 * 1000,
  RETENTION: 24 * 60 * 60 * 1000,
  PLATFORM: 24 * 60 * 60 * 1000,
  TOP_EVENTS: 60 * 60 * 1000,      // 1 hour
  FUNNEL: 24 * 60 * 60 * 1000,     // raw funnel scan — cache a full day
  INVENTORY: 12 * 60 * 60 * 1000,
  KPI: 24 * 60 * 60 * 1000,
  EXECUTIVE: 24 * 60 * 60 * 1000,
  STATUS: 5 * 60 * 1000,           // 5 min — never poll faster
};

export const METRIC_TTL = {
  dau: TTL.DAILY,
  mau: TTL.DAILY,
  'new-users': TTL.DAILY,
  countries: TTL.COUNTRY,
  retention: TTL.RETENTION,
  d1: TTL.RETENTION,
  d7: TTL.RETENTION,
  ltv: TTL.RETENTION,
  events: TTL.TOP_EVENTS,
  funnel: TTL.FUNNEL,
  inventory: TTL.INVENTORY,
  platform: TTL.PLATFORM,
  kpi: TTL.KPI,
  executive: TTL.EXECUTIVE,
  status: TTL.STATUS,
};

export function ttlFor(metric) {
  return METRIC_TTL[metric] ?? TTL.DAILY;
}
