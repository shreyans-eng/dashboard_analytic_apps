/** Yearly list price (USD) — not Firebase in_app_purchase value. */
export const YEARLY_LIST_PRICE: Record<string, number> = {
  banknote: 20,
  coinzy: 15,
};

export const ALL_PACKS = '(all packs)';
export const YEARLY_ROLLUP = '(yearly)';

export function yearlyListPrice(productId: string | undefined): number | null {
  if (!productId) return null;
  const price = YEARLY_LIST_PRICE[productId.toLowerCase()];
  return price == null ? null : price;
}

export function isRollupPack(packName: string | undefined | null): boolean {
  const name = String(packName || '');
  return name === ALL_PACKS || name === YEARLY_ROLLUP;
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
