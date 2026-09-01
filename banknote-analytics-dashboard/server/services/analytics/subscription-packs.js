/**
 * Packs taken: unique people per day per pack.
 * Yearly $ is unique people × share × Play US list
 * (Banknote 20% of $22.99 / offer $11.99; Coinzy 15% of $29.99 / half $14.99).
 * Monthly and lifetime are not estimated.
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
/**
 * Banknote store SKUs from GA Product ID (in_app_purchase items.item_id).
 * yearly_*_offer is the promo yearly wall — keep it out of the full yearly list.
 */
export const BANKNOTE_PACK_SKUS = Object.freeze({
  yearly_banknote_pack_offer: { kind: 'Yearly', offer: 'half_pack', billing: 'SUBS' },
  yearly_banknote_pack: { kind: 'Yearly', offer: 'full_pack', billing: 'SUBS' },
  monthly_banknote_pack: { kind: 'Monthly', offer: 'full_pack', billing: 'SUBS' },
  lifetime_banknote_pack_offer: { kind: 'Lifetime', offer: 'half_pack', billing: 'IAP' },
});

export const COINZY_PACK_SKUS = Object.freeze({
  yearly_coin_pack: { kind: 'Yearly', offer: 'full_pack', billing: 'SUBS', listUsd: 29.99 },
  monthly_coin_pack: { kind: 'Monthly', offer: 'full_pack', billing: 'SUBS', listUsd: 4.49 },
  lifetime_coin: { kind: 'Lifetime', offer: 'full_pack', billing: 'IAP', listUsd: 54.99 },
  yearly_coin_half_pack: { kind: 'Yearly', offer: 'half_pack', billing: 'SUBS', listUsd: 14.99 },
  lifetime_pack_half_price: { kind: 'Lifetime', offer: 'half_pack', billing: 'IAP', listUsd: 26.99 },
  yearly_coinzy_pack_trial: { kind: 'Yearly', offer: 'full_pack1', billing: 'SUBS', listUsd: 29.99 },
  yearly_coinzy_pack_trial_half_price: { kind: 'Yearly', offer: 'half_pack1', billing: 'SUBS', listUsd: 14.99 },
});

export function classifyBanknotePack(packName) {
  const key = String(packName || '').toLowerCase();
  const skus = Object.keys(BANKNOTE_PACK_SKUS).sort((a, b) => b.length - a.length);
  for (const sku of skus) {
    if (key === sku || key.includes(sku)) return { sku, ...BANKNOTE_PACK_SKUS[sku] };
  }
  if (/lifetime|life_time|life.?time/.test(key)) {
    return { sku: null, kind: 'Lifetime', offer: /half|discount|offer/.test(key) ? 'half_pack' : 'full_pack', billing: 'IAP' };
  }
  if (/yearly|year|annual/.test(key)) {
    const trial = /trial/.test(key);
    const half = /half|discount|offer/.test(key);
    return {
      sku: null,
      kind: 'Yearly',
      offer: half ? 'half_pack' : trial ? 'full_pack1' : 'full_pack',
      billing: 'SUBS',
    };
  }
  if (/monthly|month/.test(key)) {
    return { sku: null, kind: 'Monthly', offer: /half|discount|offer/.test(key) ? 'half_pack' : 'full_pack', billing: 'SUBS' };
  }
  return { sku: null, kind: 'Other', offer: null, billing: null };
}

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

/** Play Console US: yearly_banknote_pack $22.99 · yearly_banknote_pack_offer $11.99. */
export const BANKNOTE_YEARLY_FACE_PRICE = 22.99;
export const BANKNOTE_YEARLY_OFFER_FACE_PRICE = 11.99;
export const COINZY_YEARLY_FACE_PRICE = 29.99;
export const COINZY_YEARLY_HALF_FACE_PRICE = 14.99;
export const COINZY_MONTHLY_FACE_PRICE = 4.49;
export const COINZY_LIFETIME_FACE_PRICE = 54.99;
export const COINZY_LIFETIME_HALF_FACE_PRICE = 26.99;
export const YEARLY_FACE_PRICE = BANKNOTE_YEARLY_FACE_PRICE;
/** Banknote default. Coinzy yearly is 15%. Monthly / lifetime have no estimated $. */
export const YEARLY_NET_SHARE = 0.20;
export const YEARLY_NET_SHARE_BY_PRODUCT = Object.freeze({
  banknote: 0.20,
  coinzy: 0.15,
});
export const YEARLY_LIST_PRICE = Object.freeze({
  banknote: BANKNOTE_YEARLY_FACE_PRICE,
  coinzy: COINZY_YEARLY_FACE_PRICE,
});
export const YEARLY_OFFER_LIST_PRICE = Object.freeze({
  banknote: BANKNOTE_YEARLY_OFFER_FACE_PRICE,
  coinzy: COINZY_YEARLY_HALF_FACE_PRICE,
});
export const PACK_SKU_PRICES = Object.freeze({
  banknote: Object.freeze({
    yearly_banknote_pack: BANKNOTE_YEARLY_FACE_PRICE,
    yearly_banknote_pack_offer: BANKNOTE_YEARLY_OFFER_FACE_PRICE,
  }),
  coinzy: Object.freeze({
    yearly_coinzy_pack_trial_half_price: COINZY_YEARLY_HALF_FACE_PRICE,
    yearly_coinzy_pack_trial: COINZY_YEARLY_FACE_PRICE,
    yearly_coin_half_pack: COINZY_YEARLY_HALF_FACE_PRICE,
    yearly_coin_pack: COINZY_YEARLY_FACE_PRICE,
    monthly_coin_pack: COINZY_MONTHLY_FACE_PRICE,
    lifetime_pack_half_price: COINZY_LIFETIME_HALF_FACE_PRICE,
    lifetime_coin: COINZY_LIFETIME_FACE_PRICE,
  }),
});

export function yearlyListPrice(productId) {
  const id = String(productId || '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(YEARLY_LIST_PRICE, id)
    ? YEARLY_LIST_PRICE[id]
    : null;
}

export function yearlyOfferListPrice(productId) {
  const id = String(productId || '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(YEARLY_OFFER_LIST_PRICE, id)
    ? YEARLY_OFFER_LIST_PRICE[id]
    : null;
}

export function packListPrice(productId, packName) {
  const id = String(productId || '').toLowerCase();
  const key = String(packName || '').toLowerCase();
  const map = PACK_SKU_PRICES[id];
  if (map && key) {
    const skus = Object.keys(map).sort((a, b) => b.length - a.length);
    for (const sku of skus) {
      if (key === sku || key.includes(sku)) return map[sku];
    }
  }
  if (!key) return yearlyListPrice(productId);
  if (isHalfYearlyPack(packName)) return yearlyOfferListPrice(productId);
  if (/year|annual/.test(key)) return yearlyListPrice(productId);
  if (id === 'coinzy' && /month/.test(key)) return COINZY_MONTHLY_FACE_PRICE;
  if (id === 'coinzy' && /lifetime|life_time|life.?time/.test(key)) {
    return /half/.test(key) ? COINZY_LIFETIME_HALF_FACE_PRICE : COINZY_LIFETIME_FACE_PRICE;
  }
  return null;
}

export function yearlyNetShare(productId) {
  const id = String(productId || '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(YEARLY_NET_SHARE_BY_PRODUCT, id)
    ? YEARLY_NET_SHARE_BY_PRODUCT[id]
    : YEARLY_NET_SHARE;
}

/** Estimated $ applies to yearly / half-yearly only — not monthly or lifetime. */
export function isYearlyEstimatePack(packName) {
  if (packName == null || packName === '') return true;
  if (isRollupPack(packName)) return packName === YEARLY_ROLLUP;
  return /year|annual/.test(String(packName).toLowerCase());
}

export function yearlyFacePrice(productId, packName) {
  return packListPrice(productId, packName) ?? YEARLY_FACE_PRICE;
}

/** unique people × yearly share × Play US list. Banknote 20%, Coinzy 15%. Yearly only. */
export function yearlyNetUsd(uniqueUsers, productId, packName) {
  const users = Number(uniqueUsers || 0);
  if (!Number.isFinite(users) || users <= 0) return 0;
  if (!isYearlyEstimatePack(packName)) return 0;
  return users * yearlyNetShare(productId) * yearlyFacePrice(productId, packName);
}

export function packEstimateUsd(uniqueUsers, productId, packName) {
  if (!isYearlyEstimatePack(packName)) return null;
  return yearlyNetUsd(uniqueUsers, productId, packName);
}

export function isHalfYearlyPack(packName) {
  const key = String(packName || '').toLowerCase();
  if (!/year|annual/.test(key)) return false;
  return /half|offer/.test(key);
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
  return classifyBanknotePack(packName);
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
  let yearlyFullUsers = 0;
  let yearlyHalfUsers = 0;
  for (const row of named) {
    const classified = classifyPack(row.pack_name, productId);
    const bucket = offerBucket(classified);
    offers[bucket] = (offers[bucket] || 0) + Number(row.unique_users || 0);
    if (classified.kind !== 'Yearly') continue;
    const users = Number(row.unique_users || 0);
    if (isHalfYearlyPack(row.pack_name) || bucket === 'half') yearlyHalfUsers += users;
    else yearlyFullUsers += users;
  }
  const leftoverYearly = Math.max(0, yearlyUsers - yearlyFullUsers - yearlyHalfUsers);
  yearlyFullUsers += leftoverYearly;
  const yearlyFullRevenue = yearlyNetUsd(yearlyFullUsers, productId);
  const yearlyHalfRevenue = yearlyNetUsd(yearlyHalfUsers, productId, 'yearly_offer');
  return {
    unique_users: uniqueUsers,
    takes,
    yearly_users: yearlyUsers,
    yearly_full_users: yearlyFullUsers,
    yearly_half_users: yearlyHalfUsers,
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
    yearly_face_price: price ?? YEARLY_FACE_PRICE,
    yearly_net_share: yearlyNetShare(productId),
    yearly_revenue: yearlyFullRevenue,
    yearly_half_revenue: yearlyHalfRevenue,
  };
}
