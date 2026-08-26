/** Page + product permission catalog. Keep in sync with server/access.js */

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
    { id: 'explorer.ltv', label: 'Cohort LTV', path: '/ltv' },
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
  '/funnels/identify': 'funnels.identify',
  '/funnels/catalogue': 'funnels.catalogue',
  '/funnels/marketplace': 'funnels.marketplace',
  '/funnels/paywall': 'funnels.paywall',
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
  '/mau': 'explorer.mau',
  '/new-users': 'explorer.new-users',
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
  return pages.includes('*') || pages.includes(pageId);
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
