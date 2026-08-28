/**
 * Page + product permission catalog.
 * Must stay in sync with src/lib/access.ts (same ids, labels, paths).
 */

export const PAGE_CATALOG = [
  { section: 'Overview', items: [
    { id: 'home', label: 'Home', path: '/' },
    { id: 'product', label: 'Product Analytics', path: '/product' },
    { id: 'compare', label: 'Compare Apps', path: '/compare' },
    { id: 'report', label: 'Health report', path: '/report' },
  ]},
  { section: 'Funnels', items: [
    { id: 'funnels.identify', label: 'Identify (all)', path: '/funnels/identify' },
    { id: 'funnels.identify-nav', label: 'Scan · bottom nav', path: '/funnels/identify-nav' },
    { id: 'funnels.identify-home', label: 'Scan · home / banner', path: '/funnels/identify-home' },
    { id: 'funnels.identify-camera', label: 'Scan · camera', path: '/funnels/identify-camera' },
    { id: 'funnels.identify-gallery', label: 'Scan · gallery', path: '/funnels/identify-gallery' },
    { id: 'funnels.catalogue', label: 'Catalogue (all)', path: '/funnels/catalogue' },
    { id: 'funnels.collection', label: 'Private collection', path: '/funnels/collection' },
    { id: 'funnels.global', label: 'Global catalogue', path: '/funnels/global' },
    { id: 'funnels.marketplace', label: 'Marketplace', path: '/funnels/marketplace' },
    { id: 'funnels.feed', label: 'Feed', path: '/funnels/feed' },
    { id: 'funnels.paywall', label: 'Paywall', path: '/funnels/paywall' },
    { id: 'funnels.paywall-onboarding', label: 'Onboarding → subs', path: '/funnels/paywall-onboarding' },
    { id: 'funnels.expert', label: 'Expert evaluation', path: '/funnels/expert' },
    { id: 'events-explorer', label: 'Event inventory', path: '/events-explorer' },
  ]},
  { section: 'MVP KPIs', items: [
    { id: 'mvp.dau', label: '1. DAU (opened app)', path: '/mvp/dau' },
    { id: 'mvp.time-to-first-scan', label: '2. Install → first scan', path: '/mvp/time-to-first-scan' },
    { id: 'mvp.identify-success', label: '3. Identify success', path: '/mvp/identify-success' },
    { id: 'mvp.quota-hit', label: '4. Quota hit', path: '/mvp/quota-hit' },
    { id: 'mvp.paywall', label: '5. Paywall → purchase', path: '/mvp/paywall' },
    { id: 'mvp.retention', label: '6. D1 / D4 / D7 retention', path: '/mvp/retention' },
    { id: 'mvp.scans-per-user', label: '7. Scans / user', path: '/mvp/scans-per-user' },
    { id: 'mvp.identify-funnel', label: '8. Identify funnel', path: '/mvp/identify-funnel' },
    { id: 'mvp.catalogue', label: '9. Collection vs catalogue', path: '/mvp/catalogue' },
    { id: 'mvp.marketplace', label: '10. Marketplace', path: '/mvp/marketplace' },
  ]},
  { section: 'Explorer', items: [
    { id: 'explorer.ltv', label: 'Cohort LTV', path: '/ltv' },
    { id: 'explorer.dau', label: 'Daily Active Users', path: '/dau' },
    { id: 'explorer.user-mix', label: 'Unique vs repeat', path: '/user-mix' },
    { id: 'explorer.mau', label: 'Monthly Active Users', path: '/mau' },
    { id: 'explorer.new-users', label: 'New Users', path: '/new-users' },
    { id: 'explorer.install-day-usage', label: 'Installs + time used', path: '/install-day-usage' },
    { id: 'explorer.percentiles', label: 'D0 / D1 percentiles', path: '/percentiles' },
    { id: 'explorer.scan-limits', label: 'Scan limits', path: '/scan-limits' },
    { id: 'explorer.free-scan-quota', label: 'Free-scan success quota', path: '/free-scan-quota' },
    { id: 'explorer.d1', label: 'D1 Retention', path: '/d1-retention' },
    { id: 'explorer.d7', label: 'D7 Retention', path: '/d7-retention' },
    { id: 'explorer.countries', label: 'Top Countries', path: '/countries' },
    { id: 'explorer.platform', label: 'Platform', path: '/platform' },
    { id: 'explorer.events', label: 'Top Events', path: '/events' },
  ]},
  { section: 'Tools', items: [
    { id: 'sql', label: 'Query library', path: '/sql' },
  ]},
];

export const ASSIGNABLE_PAGE_IDS = PAGE_CATALOG.flatMap((s) => s.items.map((i) => i.id));

export const PRODUCT_OPTIONS = [
  { id: 'banknote', label: 'Banknote' },
  { id: 'coinzy', label: 'Coinzy' },
];

export function productLabel(id) {
  return PRODUCT_OPTIONS.find((p) => p.id === id)?.label || id;
}

export function isAdmin(user) {
  return Boolean(user && user.role === 'admin');
}

export function canAccessPage(user, pageId) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (pageId === 'admin.users') return false;
  const pages = user.permissions?.pages || [];
  if (pages.includes('*') || pages.includes(pageId)) return true;
  if (
    (pageId === 'funnels.identify-nav'
      || pageId === 'funnels.identify-home'
      || pageId === 'funnels.identify-camera'
      || pageId === 'funnels.identify-gallery') &&
    pages.includes('funnels.identify')
  ) {
    return true;
  }
  if (
    (pageId === 'funnels.collection' || pageId === 'funnels.global') &&
    pages.includes('funnels.catalogue')
  ) {
    return true;
  }
  if (pageId === 'funnels.feed' && pages.includes('funnels.marketplace')) {
    return true;
  }
  if (pageId === 'funnels.paywall-onboarding' && pages.includes('funnels.paywall')) {
    return true;
  }
  if (pageId === 'funnels.expert' && pages.some((p) => String(p).startsWith('funnels.'))) {
    return true;
  }
  if (
    pageId === 'explorer.user-mix'
    && (pages.includes('explorer.dau') || pages.includes('mvp.dau'))
  ) {
    return true;
  }
  if (
    pageId === 'explorer.install-day-usage'
    && (pages.includes('explorer.new-users') || pages.includes('mvp.time-to-first-scan'))
  ) {
    return true;
  }
  if (
    pageId === 'explorer.percentiles'
    && (pages.includes('explorer.install-day-usage')
      || pages.includes('mvp.scans-per-user')
      || pages.includes('mvp.retention')
      || pages.includes('explorer.d1'))
  ) {
    return true;
  }
  if (
    pageId === 'explorer.scan-limits'
    && (pages.includes('mvp.quota-hit') || pages.includes('funnels.identify'))
  ) {
    return true;
  }
  if (
    pageId === 'explorer.free-scan-quota'
    && (pages.includes('mvp.quota-hit')
      || pages.includes('explorer.scan-limits')
      || pages.includes('funnels.identify'))
  ) {
    return true;
  }
  if (
    pageId === 'report'
    && (pages.includes('product') || pages.includes('compare') || pages.includes('home'))
  ) {
    return true;
  }
  return false;
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
    email: doc.email || '',
    receiveReports: doc.receiveReports !== false,
  };
}

export function pageIdForApiPath(pathname) {
  const p = String(pathname || '');
  if (p.startsWith('/api/sql') || p.startsWith('/api/queries') || p === '/api/query/run') return 'sql';
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
