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
export const YEARLY_NET_SHARE_BY_PRODUCT: Record<string, number> = {
  banknote: 0.20,
  coinzy: 0.15,
};
export const YEARLY_LIST_PRICE: Record<string, number> = {
  banknote: BANKNOTE_YEARLY_FACE_PRICE,
  coinzy: COINZY_YEARLY_FACE_PRICE,
};
export const YEARLY_OFFER_LIST_PRICE: Record<string, number> = {
  banknote: BANKNOTE_YEARLY_OFFER_FACE_PRICE,
  coinzy: COINZY_YEARLY_HALF_FACE_PRICE,
};
export const PACK_SKU_PRICES: Record<string, Record<string, number>> = {
  banknote: {
    yearly_banknote_pack: BANKNOTE_YEARLY_FACE_PRICE,
    yearly_banknote_pack_offer: BANKNOTE_YEARLY_OFFER_FACE_PRICE,
  },
  coinzy: {
    yearly_coinzy_pack_trial_half_price: COINZY_YEARLY_HALF_FACE_PRICE,
    yearly_coinzy_pack_trial: COINZY_YEARLY_FACE_PRICE,
    yearly_coin_half_pack: COINZY_YEARLY_HALF_FACE_PRICE,
    yearly_coin_pack: COINZY_YEARLY_FACE_PRICE,
    monthly_coin_pack: COINZY_MONTHLY_FACE_PRICE,
    lifetime_pack_half_price: COINZY_LIFETIME_HALF_FACE_PRICE,
    lifetime_coin: COINZY_LIFETIME_FACE_PRICE,
  },
};

export const ALL_PACKS = '(all packs)';
export const YEARLY_ROLLUP = '(yearly)';
export const MONTHLY_ROLLUP = '(monthly)';
export const LIFETIME_ROLLUP = '(lifetime)';
export const CLICKS_ROLLUP = '(pack clicks)';

/** Coinzy paywall SKUs — kind is Yearly / Monthly / Lifetime, not the offer group. */
export const COINZY_PACK_LABELS: Record<string, string> = {
  yearly_coin_pack: 'Yearly · full',
  monthly_coin_pack: 'Monthly · full',
  lifetime_coin: 'Lifetime · full',
  yearly_coin_half_pack: 'Half yearly',
  lifetime_pack_half_price: 'Lifetime · half price',
  yearly_coinzy_pack_trial: 'Yearly trial · full',
  yearly_coinzy_pack_trial_half_price: 'Half yearly trial',
};

export const BANKNOTE_PACK_LABELS: Record<string, string> = {
  yearly_banknote_pack: 'Yearly',
  yearly_banknote_pack_offer: 'Yearly offer',
  monthly_banknote_pack: 'Monthly',
  lifetime_banknote_pack_offer: 'Lifetime offer',
};

export function packDisplayName(packName: string | undefined | null): string {
  const raw = String(packName || '(unnamed pack)');
  const key = raw.toLowerCase();
  const labels = { ...COINZY_PACK_LABELS, ...BANKNOTE_PACK_LABELS };
  const skus = Object.keys(labels).sort((a, b) => b.length - a.length);
  for (const sku of skus) {
    if (key === sku || key.includes(sku)) return labels[sku];
  }
  return raw;
}

export function yearlyListPrice(productId: string | undefined | null): number | null {
  if (!productId) return null;
  const price = YEARLY_LIST_PRICE[productId.toLowerCase()];
  return price == null ? null : price;
}

export function yearlyOfferListPrice(productId: string | undefined | null): number | null {
  if (!productId) return null;
  const price = YEARLY_OFFER_LIST_PRICE[productId.toLowerCase()];
  return price == null ? null : price;
}

export function packListPrice(
  productId?: string | null,
  packName?: string | null,
): number | null {
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

export function yearlyNetShare(productId?: string | null): number {
  const id = String(productId || '').toLowerCase();
  if (Object.prototype.hasOwnProperty.call(YEARLY_NET_SHARE_BY_PRODUCT, id)) {
    return YEARLY_NET_SHARE_BY_PRODUCT[id];
  }
  return YEARLY_NET_SHARE;
}

/** Estimated $ applies to yearly / half-yearly only — not monthly or lifetime. */
export function isYearlyEstimatePack(packName?: string | null): boolean {
  if (packName == null || packName === '') return true;
  if (isRollupPack(packName)) return packName === YEARLY_ROLLUP;
  return /year|annual/.test(String(packName).toLowerCase());
}

export function yearlyFacePrice(
  productId?: string | null,
  packName?: string | null,
): number {
  return packListPrice(productId, packName) ?? YEARLY_FACE_PRICE;
}

/** unique people × yearly share × Play US list. Banknote 20%, Coinzy 15%. Yearly only. */
export function yearlyNetUsd(
  uniqueUsers: unknown,
  productId?: string | null,
  packName?: string | null,
): number {
  const users = Number(uniqueUsers || 0);
  if (!Number.isFinite(users) || users <= 0) return 0;
  if (!isYearlyEstimatePack(packName)) return 0;
  return users * yearlyNetShare(productId) * yearlyFacePrice(productId, packName);
}

export function packEstimateUsd(
  uniqueUsers: unknown,
  productId?: string | null,
  packName?: string | null,
): number | null {
  if (!isYearlyEstimatePack(packName)) return null;
  return yearlyNetUsd(uniqueUsers, productId, packName);
}

export function isHalfYearlyPack(packName: string | undefined | null): boolean {
  const key = String(packName || '').toLowerCase();
  if (!/year|annual/.test(key)) return false;
  return /half|offer/.test(key);
}

export function isRollupPack(packName: string | undefined | null): boolean {
  const name = String(packName || '');
  return name === ALL_PACKS || name === YEARLY_ROLLUP || name === MONTHLY_ROLLUP
    || name === LIFETIME_ROLLUP || name === CLICKS_ROLLUP;
}

export function splitPacksByKind(packs: PackRow[]): {
  yearly: PackRow[];
  yearlyHalf: PackRow[];
  monthly: PackRow[];
  lifetime: PackRow[];
  other: PackRow[];
} {
  const yearly: PackRow[] = [];
  const yearlyHalf: PackRow[] = [];
  const monthly: PackRow[] = [];
  const lifetime: PackRow[] = [];
  const other: PackRow[] = [];
  for (const row of packs) {
    const kind = packKind(row);
    if (kind === 'Yearly' && isHalfYearlyPack(row.pack_name)) yearlyHalf.push(row);
    else if (kind === 'Yearly') yearly.push(row);
    else if (kind === 'Monthly') monthly.push(row);
    else if (kind === 'Lifetime') lifetime.push(row);
    else other.push(row);
  }
  return { yearly, yearlyHalf, monthly, lifetime, other };
}

export function packEventHint(productId: string | undefined): string {
  const id = String(productId || '').toLowerCase();
  if (id === 'banknote') {
    return 'Taken: store in_app_purchase product ID. Yearly estimate is 20% of Play US list ($22.99 / offer $11.99). Monthly and lifetime are people counts only. Pack click: Subs_pack.';
  }
  if (id === 'coinzy') {
    return 'Taken: store in_app_purchase SKU. Yearly estimate is 15% of Play US list ($29.99 / half $14.99). Monthly and lifetime are people counts only. Pack click: subs_pack.';
  }
  return '';
}

export type PackKind = 'Yearly' | 'Monthly' | 'Lifetime' | 'Other' | 'All';

export type PackRow = {
  grain?: string;
  event_date?: string | null;
  pack_name?: string;
  pack_kind?: string;
  unique_users?: number;
  takes?: number;
  product?: string;
  product_id?: string;
};

export function n(v: unknown): number {
  const x = Number(v || 0);
  return Number.isFinite(x) ? x : 0;
}

export function packKind(row: PackRow): PackKind {
  const kind = String(row.pack_kind || '');
  if (kind === 'Yearly' || kind === 'Monthly' || kind === 'Lifetime' || kind === 'All') {
    return kind;
  }
  return 'Other';
}

export function packKindLabel(row: PackRow): string {
  if (packKind(row) === 'Yearly' && isHalfYearlyPack(row.pack_name)) {
    const name = String(row.pack_name || '').toLowerCase();
    if (/offer/.test(name) && !/half/.test(name)) return 'Yearly offer';
    return 'Half yearly';
  }
  return packKind(row);
}
