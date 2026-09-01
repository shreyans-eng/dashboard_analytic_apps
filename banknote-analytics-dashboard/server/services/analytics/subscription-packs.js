/**
 * Packs taken: unique people per day per pack.
 * Yearly list price is a product constant — not Firebase in_app_purchase USD.
 */
export const ALL_PACKS = '(all packs)';
export const YEARLY_ROLLUP = '(yearly)';

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

export function isRollupPack(packName) {
  const name = String(packName || '');
  return name === ALL_PACKS || name === YEARLY_ROLLUP;
}

export function summarizePackRows(rows, productId) {
  const list = Array.isArray(rows) ? rows : [];
  const rangeAll = list.find((r) => r.grain === 'range' && r.pack_name === ALL_PACKS);
  const rangeYearly = list.find((r) => r.grain === 'range' && r.pack_name === YEARLY_ROLLUP);
  const price = yearlyListPrice(productId);
  const yearlyUsers = Number(rangeYearly?.unique_users || 0);
  return {
    unique_users: Number(rangeAll?.unique_users || 0),
    takes: Number(rangeAll?.takes || 0),
    yearly_users: yearlyUsers,
    yearly_takes: Number(rangeYearly?.takes || 0),
    yearly_list_price: price,
    yearly_revenue: price == null ? null : yearlyUsers * price,
  };
}
