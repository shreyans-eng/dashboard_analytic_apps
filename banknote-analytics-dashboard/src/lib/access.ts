/**
 * Page + product permission catalog.
 * Must stay in sync with server/access.js (same ids, labels, paths).
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
    { id: 'funnels.collection', label: 'Private collection', path: '/funnels/collection' },
    { id: 'funnels.global', label: 'Global catalogue', path: '/funnels/global' },
    { id: 'funnels.marketplace', label: 'Marketplace', path: '/funnels/marketplace' },
    { id: 'funnels.feed', label: 'Feed', path: '/funnels/feed' },
    { id: 'funnels.onboarding', label: 'Onboarding', path: '/funnels/onboarding' },
    { id: 'funnels.paywall', label: 'Paywall', path: '/funnels/paywall' },
    { id: 'funnels.paywall-onboarding', label: 'Onboarding → subs', path: '/funnels/paywall-onboarding' },
    { id: 'funnels.expert', label: 'Expert evaluation', path: '/funnels/expert' },
    { id: 'events-catalog', label: 'Event catalog', path: '/events-catalog' },
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
] as const;

export const PRODUCT_OPTIONS = [
  { id: 'banknote', label: 'Banknote' },
  { id: 'coinzy', label: 'Coinzy' },
];

export type PageId = (typeof PAGE_CATALOG)[number]['items'][number]['id'] | 'admin.users';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'sub_admin';
  active: boolean;
  isAdmin: boolean;
  email?: string;
  receiveReports?: boolean;
  permissions: {
    products: string[];
    pages: string[];
  };
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface AccessMeta {
  pages: { section: string; items: { id: string; label: string; path: string }[] }[];
  products: { id: string; label: string }[];
  roles: { id: string; label: string }[];
  mongo?: { configured: boolean; connected: boolean; db?: string };
}

const PATH_TO_PAGE: Record<string, PageId> = {
  '/': 'home',
  '/product': 'product',
  '/compare': 'compare',
  '/report': 'report',
  '/funnels/identify': 'funnels.identify',
  '/funnels/identify-nav': 'funnels.identify-nav',
  '/funnels/identify-home': 'funnels.identify-home',
  '/funnels/identify-camera': 'funnels.identify-camera',
  '/funnels/identify-gallery': 'funnels.identify-gallery',
  '/funnels/catalogue': 'funnels.collection',
  '/funnels/collection': 'funnels.collection',
  '/funnels/global': 'funnels.global',
  '/funnels/marketplace': 'funnels.marketplace',
  '/funnels/feed': 'funnels.feed',
  '/funnels/onboarding': 'funnels.onboarding',
  '/funnels/paywall': 'funnels.paywall',
  '/funnels/paywall-onboarding': 'funnels.paywall-onboarding',
  '/funnels/expert': 'funnels.expert',
  '/events-catalog': 'events-catalog',
  '/events-explorer': 'events-explorer',
  '/mvp/dau': 'mvp.dau',
  '/mvp/time-to-first-scan': 'mvp.time-to-first-scan',
  '/mvp/identify-success': 'mvp.identify-success',
  '/mvp/quota-hit': 'mvp.quota-hit',
  '/mvp/paywall': 'mvp.paywall',
  '/mvp/retention': 'mvp.retention',
  '/mvp/scans-per-user': 'mvp.scans-per-user',
  '/mvp/identify-funnel': 'mvp.identify-funnel',
  '/mvp/catalogue': 'mvp.catalogue',
  '/mvp/marketplace': 'mvp.marketplace',
  '/ltv': 'explorer.ltv',
  '/dau': 'explorer.dau',
  '/user-mix': 'explorer.user-mix',
  '/mau': 'explorer.mau',
  '/new-users': 'explorer.new-users',
  '/install-day-usage': 'explorer.install-day-usage',
  '/percentiles': 'explorer.percentiles',
  '/scan-limits': 'explorer.scan-limits',
  '/free-scan-quota': 'explorer.free-scan-quota',
  '/d1-retention': 'explorer.d1',
  '/d7-retention': 'explorer.d7',
  '/countries': 'explorer.countries',
  '/platform': 'explorer.platform',
  '/events': 'explorer.events',
  '/sql': 'sql',
  '/admin/users': 'admin.users',
};

export function isAdmin(user: AuthUser | null | undefined): boolean {
  return Boolean(user?.isAdmin || user?.role === 'admin');
}

export function canAccessPage(user: AuthUser | null | undefined, pageId: string): boolean {
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
  if (
    (pageId === 'funnels.paywall-onboarding' || pageId === 'funnels.onboarding') &&
    pages.includes('funnels.paywall')
  ) {
    return true;
  }
  if (pageId === 'funnels.expert' && pages.some((p) => p.startsWith('funnels.'))) {
    return true;
  }
  if (pageId === 'events-catalog' && pages.includes('events-explorer')) {
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

export function canAccessProduct(user: AuthUser | null | undefined, productId: string): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  const products = user.permissions?.products || [];
  if (productId === 'compare') {
    return canAccessPage(user, 'compare') && (products.includes('*') || products.length >= 2);
  }
  return products.includes('*') || products.includes(productId);
}

export function pageIdFromPath(pathname: string): PageId | null {
  return PATH_TO_PAGE[pathname] || null;
}

export function firstAllowedPath(user: AuthUser | null | undefined): string {
  if (!user) return '/';
  if (isAdmin(user)) return '/';
  for (const section of PAGE_CATALOG) {
    for (const item of section.items) {
      if (canAccessPage(user, item.id)) return item.path;
    }
  }
  return '/';
}

export function pageLabel(id: string): string {
  for (const section of PAGE_CATALOG) {
    const item = section.items.find((i) => i.id === id);
    if (item) return item.label;
  }
  return id;
}

export function productLabel(id: string): string {
  return PRODUCT_OPTIONS.find((p) => p.id === id)?.label || id;
}

export function allAssignablePageIds(): string[] {
  return PAGE_CATALOG.flatMap((s) => s.items.map((i) => i.id));
}
