/** Yearly list price (USD) — not Firebase in_app_purchase value. */
export const YEARLY_LIST_PRICE: Record<string, number> = {
  banknote: 20,
  coinzy: 15,
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
  yearly_coin_half_pack: 'Yearly · half price',
  lifetime_pack_half_price: 'Lifetime · half price',
  yearly_coinzy_pack_trial: 'Yearly trial · full',
  yearly_coinzy_pack_trial_half_price: 'Yearly trial · half price',
};

export function packDisplayName(packName: string | undefined | null): string {
  const raw = String(packName || '(unnamed pack)');
  const key = raw.toLowerCase();
  const labels = Object.keys(COINZY_PACK_LABELS).sort((a, b) => b.length - a.length);
  for (const sku of labels) {
    if (key === sku || key.includes(sku)) return COINZY_PACK_LABELS[sku];
  }
  return raw;
}

export function yearlyListPrice(productId: string | undefined): number | null {
  if (!productId) return null;
  const price = YEARLY_LIST_PRICE[productId.toLowerCase()];
  return price == null ? null : price;
}

export function isRollupPack(packName: string | undefined | null): boolean {
  const name = String(packName || '');
  return name === ALL_PACKS || name === YEARLY_ROLLUP || name === MONTHLY_ROLLUP
    || name === LIFETIME_ROLLUP || name === CLICKS_ROLLUP;
}

export function splitPacksByKind(packs: PackRow[]): {
  yearly: PackRow[];
  monthly: PackRow[];
  lifetime: PackRow[];
  other: PackRow[];
} {
  const yearly: PackRow[] = [];
  const monthly: PackRow[] = [];
  const lifetime: PackRow[] = [];
  const other: PackRow[] = [];
  for (const row of packs) {
    const kind = packKind(row);
    if (kind === 'Yearly') yearly.push(row);
    else if (kind === 'Monthly') monthly.push(row);
    else if (kind === 'Lifetime') lifetime.push(row);
    else other.push(row);
  }
  return { yearly, monthly, lifetime, other };
}

export function packEventHint(productId: string | undefined): string {
  const id = String(productId || '').toLowerCase();
  if (id === 'banknote') return 'Pack click: Subs_pack · Confirm: Subs_confirm';
  if (id === 'coinzy') {
    return 'Pack click: subs_pack / subs_pack_discount · Confirm: subs_confirm / paid_purchase. SKUs: yearly_coin_pack, monthly_coin_pack, lifetime_coin (+ half / trial).';
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
