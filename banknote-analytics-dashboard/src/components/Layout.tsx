/**
 * Shell: product switcher, sidebar (filtered by access), theme, sign-out.
 * NAV ids must match src/lib/access.ts PAGE_CATALOG.
 */
import { NavLink, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import LastUpdated from '@/components/LastUpdated';
import {
  Home,
  Activity,
  Calendar,
  UserPlus,
  Users,
  TrendingUp,
  Globe,
  Smartphone,
  BarChart3,
  Database,
  Code2,
  Sparkles,
  Moon,
  Sun,
  GitCompareArrows,
  Target,
  ScanLine,
  Camera,
  Images,
  PiggyBank,
  BookOpen,
  ShoppingBag,
  Timer,
  Filter,
  ListTree,
  Menu,
  X,
  LogOut,
  Shield,
  CircleDollarSign,
  Rss,
  Award,
  ClipboardList,
  Clock,
  Gauge,
  ShieldAlert,
  Percent,
  FileSpreadsheet,
  Package,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchConfig, AppConfig } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { useProduct, type ProductId } from '@/lib/product';
import { useInvalidateDashboard } from '@/hooks/useAnalytics';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import AppMark from '@/components/AppMark';
import { pageIdFromPath } from '@/lib/access';

const NAV = [
  { section: 'Overview' },
  { to: '/', pageId: 'home', label: 'Home', icon: Home },
  { to: '/product', pageId: 'product', label: 'Product Analytics', icon: Sparkles },
  { to: '/compare', pageId: 'compare', label: 'Compare Apps', icon: GitCompareArrows },
  { to: '/report', pageId: 'report', label: 'Health report', icon: ClipboardList },
  { section: 'Funnels' },
  { to: '/funnels/identify', pageId: 'funnels.identify', label: 'Identify (all)', icon: ScanLine },
  { to: '/funnels/identify-nav', pageId: 'funnels.identify-nav', label: 'Scan · bottom nav', icon: ScanLine },
  { to: '/funnels/identify-home', pageId: 'funnels.identify-home', label: 'Scan · home / banner', icon: ScanLine },
  { to: '/funnels/identify-camera', pageId: 'funnels.identify-camera', label: 'Scan · camera', icon: Camera },
  { to: '/funnels/identify-gallery', pageId: 'funnels.identify-gallery', label: 'Scan · gallery', icon: Images },
  { to: '/funnels/collection', pageId: 'funnels.collection', label: 'Private collection', icon: BookOpen },
  { to: '/funnels/global', pageId: 'funnels.global', label: 'Global catalogue', icon: Globe },
  { to: '/funnels/marketplace', pageId: 'funnels.marketplace', label: 'Marketplace', icon: ShoppingBag },
  { to: '/funnels/feed', pageId: 'funnels.feed', label: 'Feed', icon: Rss },
  { to: '/funnels/onboarding', pageId: 'funnels.onboarding', label: 'Onboarding', icon: UserPlus },
  { to: '/funnels/paywall', pageId: 'funnels.paywall', label: 'Paywall', icon: PiggyBank },
  { to: '/funnels/paywall-onboarding', pageId: 'funnels.paywall-onboarding', label: 'Onboarding → subs', icon: PiggyBank },
  { to: '/funnels/expert', pageId: 'funnels.expert', label: 'Expert evaluation', icon: Award, products: ['coinzy'] },
  { to: '/events-catalog', pageId: 'events-catalog', label: 'Event catalog', icon: FileSpreadsheet },
  { to: '/events-explorer', pageId: 'events-explorer', label: 'Event inventory', icon: ListTree },
  { section: 'Subscriptions' },
  { to: '/packs', pageId: 'explorer.packs', label: 'Packs taken', icon: Package },
  { section: 'MVP KPIs (10)' },
  { to: '/mvp/dau', pageId: 'mvp.dau', label: '1. DAU (opened app)', icon: Activity },
  { to: '/mvp/time-to-first-scan', pageId: 'mvp.time-to-first-scan', label: '2. Install → first scan', icon: Timer },
  { to: '/mvp/identify-success', pageId: 'mvp.identify-success', label: '3. Identify success', icon: ScanLine },
  { to: '/mvp/quota-hit', pageId: 'mvp.quota-hit', label: '4. Quota hit', icon: Target },
  { to: '/mvp/paywall', pageId: 'mvp.paywall', label: '5. Paywall → purchase', icon: PiggyBank },
  { to: '/mvp/retention', pageId: 'mvp.retention', label: '6. D1 / D4 / D7 retention', icon: TrendingUp },
  { to: '/mvp/scans-per-user', pageId: 'mvp.scans-per-user', label: '7. Scans / user', icon: Activity },
  { to: '/mvp/identify-funnel', pageId: 'mvp.identify-funnel', label: '8. Identify funnel', icon: Filter },
    { to: '/mvp/catalogue', pageId: 'mvp.catalogue', label: '9. Collection vs catalogue', icon: BookOpen },
  { to: '/mvp/marketplace', pageId: 'mvp.marketplace', label: '10. Marketplace', icon: ShoppingBag },
  { section: 'Explorer' },
  { to: '/ltv', pageId: 'explorer.ltv', label: 'Cohort LTV', icon: CircleDollarSign },
  { to: '/user-mix', pageId: 'explorer.user-mix', label: 'Unique vs repeat', icon: Users },
  { to: '/mau', pageId: 'explorer.mau', label: 'Monthly Active Users', icon: Calendar },
  { to: '/new-users', pageId: 'explorer.new-users', label: 'New Users', icon: UserPlus },
  { to: '/install-day-usage', pageId: 'explorer.install-day-usage', label: 'Installs + time used', icon: Clock },
  { to: '/percentiles', pageId: 'explorer.percentiles', label: 'D0 / D1 percentiles', icon: Percent },
  { to: '/scan-limits', pageId: 'explorer.scan-limits', label: 'Scan limits', icon: Gauge },
  { to: '/free-scan-quota', pageId: 'explorer.free-scan-quota', label: 'Free-scan success quota', icon: ShieldAlert, products: ['coinzy'] },
  { to: '/countries', pageId: 'explorer.countries', label: 'Top Countries', icon: Globe },
  { to: '/platform', pageId: 'explorer.platform', label: 'Platform', icon: Smartphone },
  { to: '/events', pageId: 'explorer.events', label: 'Top Events', icon: BarChart3 },
  { section: 'Tools' },
  { to: '/sql', pageId: 'sql', label: 'Query library', icon: Code2 },
  { section: 'Admin' },
  { to: '/admin/users', pageId: 'admin.users', label: 'Users & access', icon: Shield },
];

export default function Layout() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { product, productId, isCompare, canCompare, products, setProductId } = useProduct();
  const { user, logout, canAccessPage, firstPath } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const invalidate = useInvalidateDashboard();

  useEffect(() => {
    fetchConfig().then(setConfig).catch(() => {});
  }, []);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.title = isCompare
      ? `Compare — ${products.map((p) => p.shortName).join(' vs ')}`
      : `${product.brand} Analytics`;
  }, [product.brand, isCompare, products]);

  const onSelectProduct = (id: ProductId) => {
    setProductId(id);
    invalidate();
    if (id === 'compare') navigate('/compare');
    else if (location.pathname === '/compare') navigate('/product');
  };

  const activeProductMeta = config?.products?.find((p) => p.id === (isCompare ? products[0]?.id : productId));
  const footerDataset = isCompare
    ? `${products.length} apps · side-by-side`
    : `${activeProductMeta?.project || config?.project || '…'}.${activeProductMeta?.dataset || config?.dataset || ''}`;

  const pageId = pageIdFromPath(location.pathname);
  if (pageId && !canAccessPage(pageId)) {
    if (firstPath === location.pathname) {
      return (
        <div className="login-screen">
          <div className="login-card">
            <h1>No pages assigned</h1>
            <p>Ask an admin to grant you access to apps and pages, then sign in again.</p>
            <button
              type="button"
              onClick={async () => {
                await logout();
                toast.info('Signed out');
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      );
    }
    return <Navigate to={firstPath} replace />;
  }

  const navItems: Array<(typeof NAV)[number]> = [];
  let pendingSection: (typeof NAV)[number] | null = null;
  for (const item of NAV) {
    if (item.section) {
      pendingSection = item;
      continue;
    }
    if (item.pageId && !canAccessPage(item.pageId)) continue;
    if ('products' in item && Array.isArray(item.products)) {
      if (isCompare || !item.products.includes(productId)) continue;
    }
    if (pendingSection) {
      navItems.push(pendingSection);
      pendingSection = null;
    }
    navItems.push(item);
  }

  return (
    <div className={`app-shell${navOpen ? ' nav-open' : ''}`}>
      <button
        type="button"
        className="nav-backdrop"
        aria-label="Close menu"
        onClick={() => setNavOpen(false)}
      />
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-main">
            <div className="sidebar-brand-marks">
              {isCompare ? (
                products.map((p) => <AppMark key={p.id} product={p.id} size={32} />)
              ) : (
                <AppMark product={productId} size={36} />
              )}
            </div>
            <div>
              <h1>{isCompare ? 'Compare Apps' : product.brand}</h1>
              <p>{isCompare ? 'Side-by-side comparison' : 'Product Analytics Dashboard'}</p>
            </div>
          </div>
          <button
            type="button"
            className="nav-close"
            aria-label="Close menu"
            onClick={() => setNavOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-controls">
          <div className="product-switch" role="group" aria-label="Product">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                data-product={p.id}
                className={productId === p.id ? 'active' : ''}
                style={{ ['--switch-color' as string]: p.color }}
                onClick={() => onSelectProduct(p.id)}
                title={p.brand}
              >
                <AppMark product={p.id} size={16} />
                {p.shortName}
              </button>
            ))}
            {canCompare && (
              <button
                type="button"
                className={productId === 'compare' ? 'active' : ''}
                onClick={() => onSelectProduct('compare')}
              >
                Compare
              </button>
            )}
          </div>
          <div className="theme-switch" role="group" aria-label="Theme">
            <button
              type="button"
              className={theme === 'light' ? 'active' : ''}
              onClick={() => setTheme('light')}
              aria-label="Light mode"
            >
              <Sun size={13} /> Light
            </button>
            <button
              type="button"
              className={theme === 'dark' ? 'active' : ''}
              onClick={() => setTheme('dark')}
              aria-label="Dark mode"
            >
              <Moon size={13} /> Dark
            </button>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item, i) => {
            if (item.section) {
              return <div key={i} className="nav-section">{item.section}</div>;
            }
            const Icon = item.icon!;
            return (
              <NavLink
                key={item.to}
                to={item.to!}
                end={item.to === '/'}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <Icon size={16} aria-hidden />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <Database size={12} style={{ display: 'inline', marginRight: 4 }} />
          {footerDataset}
          <br />
          <span style={{ opacity: 0.8 }}>
            Mode: {isCompare ? `Compare (${products.map((p) => p.shortName).join(', ')})` : product.shortName}
          </span>
          <button
            type="button"
            className="logout-btn"
            onClick={async () => {
              await logout();
              toast.info('Signed out', 'Come back anytime');
            }}
          >
            <LogOut size={13} />
            Sign out{user ? ` (${user.displayName || user.username})` : ''}
          </button>
        </div>
      </aside>
      <main className="main">
        <div className="main-status">
          <button
            type="button"
            className="nav-toggle"
            aria-label="Open menu"
            onClick={() => setNavOpen(true)}
          >
            <Menu size={18} />
          </button>
          <LastUpdated />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
