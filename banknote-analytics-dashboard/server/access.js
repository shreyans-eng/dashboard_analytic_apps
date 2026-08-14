/** Page + product permission catalog. Keep in sync with src/lib/access.ts */

export const PAGE_CATALOG = [
  { section: 'Overview', items: [
    { id: 'home', label: 'Home', path: '/' },
    { id: 'product', label: 'Product Analytics', path: '/product' },
    { id: 'compare', label: 'Compare Apps', path: '/compare' },
  ]},
  { section: 'Funnels', items: [
    { id: 'funnels.identify', label: 'Identify', path: '/funnels/identify' },
    { id: 'funnels.catalogue', label: 'Catalogue', path: '/funnels/catalogue' },
    { id: 'funnels.marketplace', label: 'Marketplace', path: '/funnels/marketplace' },
    { id: 'funnels.paywall', label: 'Paywall', path: '/funnels/paywall' },
    { id: 'events-explorer', label: 'Event inventory', path: '/events-explorer' },
  ]},
  { section: 'MVP KPIs', items: [
    { id: 'mvp.dau', label: '1. DAU', path: '/mvp/dau' },
    { id: 'mvp.time-to-first-scan', label: '2. Time to first scan', path: '/mvp/time-to-first-scan' },
    { id: 'mvp.identify-success', label: '3. Identify success', path: '/mvp/identify-success' },
    { id: 'mvp.quota-hit', label: '4. Quota hit', path: '/mvp/quota-hit' },
    { id: 'mvp.paywall', label: '5. Paywall → purchase', path: '/mvp/paywall' },
    { id: 'mvp.retention', label: '6. D1 / D7 retention', path: '/mvp/retention' },
    { id: 'mvp.scans-per-user', label: '7. Scans / user', path: '/mvp/scans-per-user' },
    { id: 'mvp.identify-funnel', label: '8. Identify funnel', path: '/mvp/identify-funnel' },
    { id: 'mvp.catalogue', label: '9. Catalogue', path: '/mvp/catalogue' },
    { id: 'mvp.marketplace', label: '10. Marketplace', path: '/mvp/marketplace' },
  ]},
  { section: 'Explorer', items: [
    { id: 'explorer.dau', label: 'Daily Active Users', path: '/dau' },
    { id: 'explorer.mau', label: 'Monthly Active Users', path: '/mau' },
    { id: 'explorer.new-users', label: 'New Users', path: '/new-users' },
    { id: 'explorer.d1', label: 'D1 Retention', path: '/d1-retention' },
    { id: 'explorer.d7', label: 'D7 Retention', path: '/d7-retention' },
    { id: 'explorer.countries', label: 'Top Countries', path: '/countries' },
    { id: 'explorer.platform', label: 'Platform', path: '/platform' },
    { id: 'explorer.events', label: 'Top Events', path: '/events' },
  ]},
  { section: 'Tools', items: [
    { id: 'sql', label: 'SQL Editor', path: '/sql' },
  ]},
];

export const ASSIGNABLE_PAGE_IDS = PAGE_CATALOG.flatMap((s) => s.items.map((i) => i.id));

export const PRODUCT_OPTIONS = [
  { id: 'banknote', label: 'Banknote' },
  { id: 'coinzy', label: 'Coinzy' },
];

export function isAdmin(user) {
  return Boolean(user && user.role === 'admin');
}

export function canAccessPage(user, pageId) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (pageId === 'admin.users') return false;
  const pages = user.permissions?.pages || [];
  return pages.includes('*') || pages.includes(pageId);
}

export function canAccessProduct(user, productId) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (!productId) return true;
  const products = user.permissions?.products || [];
  if (productId === 'compare') {
    return canAccessPage(user, 'compare') && (products.includes('*') || products.length >= 2);
  }
  return products.includes('*') || products.includes(productId);
}

export function allowedProducts(user, allIds) {
  if (!user) return [];
  if (isAdmin(user)) return allIds;
  const assigned = user.permissions?.products || [];
  if (assigned.includes('*')) return allIds;
  return allIds.filter((id) => assigned.includes(id));
}

export function toPublicUser(doc) {
  if (!doc) return null;
  const admin = doc.role === 'admin';
  return {
    id: String(doc._id),
    username: doc.username,
    displayName: doc.displayName || doc.username,
    role: doc.role,
    active: doc.active !== false,
    isAdmin: admin,
    permissions: {
      products: admin ? ['*'] : [...(doc.permissions?.products || [])],
      pages: admin ? ['*'] : [...(doc.permissions?.pages || [])],
    },
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

export function pageIdForApiPath(pathname) {
  const p = String(pathname || '');
  if (p.startsWith('/api/sql') || p === '/api/query/run') return 'sql';
  if (p.startsWith('/api/analytics/events')) return 'events-explorer';
  const funnel = p.match(/^\/api\/analytics\/funnels\/([^/]+)$/);
  if (funnel && funnel[1] !== '') return `funnels.${funnel[1]}`;
  return null;
}

export function isAdminOnlyApi(pathname) {
  const p = String(pathname || '');
  return (
    p.startsWith('/api/admin') ||
    p === '/api/cache/clear'
  );
}
