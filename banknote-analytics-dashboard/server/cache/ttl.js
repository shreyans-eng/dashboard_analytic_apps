/**
 * Cache TTL (ms). Most metrics follow the Firebase daily export (~once/day),
 * so 24h is correct. Status is short so the "last updated" chip stays honest.
 */
export const TTL = {
  DAILY: 24 * 60 * 60 * 1000,
  TOP_EVENTS: 60 * 60 * 1000,
  INVENTORY: 12 * 60 * 60 * 1000,
  STATUS: 5 * 60 * 1000,
};

export const METRIC_TTL = {
  dau: TTL.DAILY,
  'user-mix': TTL.DAILY,
  'install-day-usage': TTL.DAILY,
  'scan-limits': TTL.DAILY,
  'free-scan-quota': TTL.DAILY,
  mau: TTL.DAILY,
  'new-users': TTL.DAILY,
  countries: TTL.DAILY,
  retention: TTL.DAILY,
  d1: TTL.DAILY,
  d7: TTL.DAILY,
  ltv: TTL.DAILY,
  events: TTL.TOP_EVENTS,
  funnel: TTL.DAILY,
  inventory: TTL.INVENTORY,
  platform: TTL.DAILY,
  kpi: TTL.DAILY,
  status: TTL.STATUS,
};

export function ttlFor(metric) {
  return METRIC_TTL[metric] ?? TTL.DAILY;
}
