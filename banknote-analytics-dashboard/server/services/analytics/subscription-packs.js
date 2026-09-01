/**
 * Packs taken: unique people per day per pack.
 * Yearly list price is a product constant — not Firebase in_app_purchase USD.
 */
export const ALL_PACKS = '(all packs)';
export const YEARLY_ROLLUP = '(yearly)';
export const MONTHLY_ROLLUP = '(monthly)';
export const LIFETIME_ROLLUP = '(lifetime)';
export const CLICKS_ROLLUP = '(pack clicks)';

/**
 * Coinzy store SKUs from the paywall JSON (full_pack / half_pack / trial variants).
 * Lifetime is a one-time IAP; yearly and monthly are subscriptions.
 */
export const COINZY_PACK_SKUS = Object.freeze({
  yearly_coin_pack: { kind: 'Yearly', offer: 'full_pack', billing: 'SUBS' },
  monthly_coin_pack: { kind: 'Monthly', offer: 'full_pack', billing: 'SUBS' },
  lifetime_coin: { kind: 'Lifetime', offer: 'full_pack', billing: 'IAP' },
  yearly_coin_half_pack: { kind: 'Yearly', offer: 'half_pack', billing: 'SUBS' },
  lifetime_pack_half_price: { kind: 'Lifetime', offer: 'half_pack', billing: 'IAP' },
  yearly_coinzy_pack_trial: { kind: 'Yearly', offer: 'full_pack1', billing: 'SUBS' },
  yearly_coinzy_pack_trial_half_price: { kind: 'Yearly', offer: 'half_pack1', billing: 'SUBS' },
});

export function classifyCoinzyPack(packName) {
  const key = String(packName || '').toLowerCase();
  const skus = Object.keys(COINZY_PACK_SKUS).sort((a, b) => b.length - a.length);
  for (const sku of skus) {
    if (key === sku || key.includes(sku)) return { sku, ...COINZY_PACK_SKUS[sku] };
  }
  if (/lifetime|life_time|life.?time/.test(key)) return { sku: null, kind: 'Lifetime', offer: null, billing: 'IAP' };
  if (/yearly|year|annual/.test(key)) return { sku: null, kind: 'Yearly', offer: null, billing: 'SUBS' };
  if (/monthly|month/.test(key)) return { sku: null, kind: 'Monthly', offer: null, billing: 'SUBS' };
  return { sku: null, kind: 'Other', offer: null, billing: null };
}

export const YEARLY_LIST_PRICE = Object.freeze({
  banknote: 20,
  coinzy: 15,
});

export function yearlyListPrice(productId) {
  const id = String(productId || '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(YEARLY_LIST_PRICE, id)
    ? YEARLY_LIST_PRICE[id]
    : null;
}

export function offerBucket(classified) {
  const offer = String(classified?.offer || '');
  if (offer === 'half_pack' || offer === 'half_pack1') return 'half';
  if (offer === 'full_pack1') return 'trial';
  if (offer === 'full_pack') return 'full';
  return 'other';
}

export function classifyPack(packName, productId) {
  const id = String(productId || '').toLowerCase();
  if (id === 'coinzy') return classifyCoinzyPack(packName);
  const key = String(packName || '').toLowerCase();
  if (/lifetime|life_time|life.?time/.test(key)) {
    return { sku: null, kind: 'Lifetime', offer: /half|discount/.test(key) ? 'half_pack' : 'full_pack', billing: 'IAP' };
  }
  if (/yearly|year|annual/.test(key)) {
    const trial = /trial/.test(key);
    const half = /half|discount/.test(key);
    return {
      sku: null,
      kind: 'Yearly',
      offer: half ? 'half_pack' : trial ? 'full_pack1' : 'full_pack',
      billing: 'SUBS',
    };
  }
  if (/monthly|month/.test(key)) {
    return { sku: null, kind: 'Monthly', offer: /half|discount/.test(key) ? 'half_pack' : 'full_pack', billing: 'SUBS' };
  }
  return { sku: null, kind: 'Other', offer: null, billing: null };
}

export function isRollupPack(packName) {
  const name = String(packName || '');
  return name === ALL_PACKS
    || name === YEARLY_ROLLUP
    || name === MONTHLY_ROLLUP
    || name === LIFETIME_ROLLUP
    || name === CLICKS_ROLLUP;
}

export function summarizePackRows(rows, productId) {
  const list = Array.isArray(rows) ? rows : [];
  const rangeAll = list.find((r) => r.grain === 'range' && r.pack_name === ALL_PACKS);
  const rangeYearly = list.find((r) => r.grain === 'range' && r.pack_name === YEARLY_ROLLUP);
  const rangeMonthly = list.find((r) => r.grain === 'range' && r.pack_name === MONTHLY_ROLLUP);
  const rangeLifetime = list.find((r) => r.grain === 'range' && r.pack_name === LIFETIME_ROLLUP);
  const rangeClicks = list.find((r) => r.grain === 'range' && r.pack_name === CLICKS_ROLLUP);
  const price = yearlyListPrice(productId);
  const uniqueUsers = Number(rangeAll?.unique_users || 0);
  const takes = Number(rangeAll?.takes || 0);
  const yearlyUsers = Number(rangeYearly?.unique_users || 0);
  const monthlyUsers = Number(rangeMonthly?.unique_users || 0);
  const lifetimeUsers = Number(rangeLifetime?.unique_users || 0);
  const clickers = Number(rangeClicks?.unique_users || 0);
  const named = list.filter((r) => r.grain === 'range' && !isRollupPack(r.pack_name));
  const offers = { full: 0, half: 0, trial: 0, other: 0 };
  for (const row of named) {
    const bucket = offerBucket(classifyPack(row.pack_name, productId));
    offers[bucket] = (offers[bucket] || 0) + Number(row.unique_users || 0);
  }
  return {
    unique_users: uniqueUsers,
    takes,
    yearly_users: yearlyUsers,
    yearly_takes: Number(rangeYearly?.takes || 0),
    monthly_users: monthlyUsers,
    monthly_takes: Number(rangeMonthly?.takes || 0),
    lifetime_users: lifetimeUsers,
    clickers,
    click_to_confirm_rate: clickers > 0 ? uniqueUsers / clickers : null,
    retries_per_user: uniqueUsers > 0 ? takes / uniqueUsers : null,
    full_users: offers.full,
    half_users: offers.half,
    trial_users: offers.trial,
    subs_users: yearlyUsers + monthlyUsers,
    iap_users: lifetimeUsers,
    yearly_list_price: price,
    yearly_revenue: price == null ? null : yearlyUsers * price,
  };
}
