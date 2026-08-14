import { NavLink, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import LastUpdated from '@/components/LastUpdated';
import {
  Home,
  Activity,
  Calendar,
  UserPlus,
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
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchConfig, AppConfig } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { useProduct, type ProductId } from '@/lib/product';
import { useInvalidateDashboard } from '@/hooks/useAnalytics';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { pageIdFromPath } from '@/lib/access';

const NAV = [
  { section: 'Overview' },
  { to: '/', pageId: 'home', label: 'Home', icon: Home },
  { to: '/product', pageId: 'product', label: 'Product Analytics', icon: Sparkles },
  { to: '/compare', pageId: 'compare', label: 'Compare Apps', icon: GitCompareArrows },
  { section: 'Funnels' },
  { to: '/funnels/identify', pageId: 'funnels.identify', label: 'Identify', icon: ScanLine },
  { to: '/funnels/catalogue', pageId: 'funnels.catalogue', label: 'Catalogue', icon: BookOpen },
  { to: '/funnels/marketplace', pageId: 'funnels.marketplace', label: 'Marketplace', icon: ShoppingBag },
  { to: '/funnels/paywall', pageId: 'funnels.paywall', label: 'Paywall', icon: PiggyBank },
  { to: '/events-explorer', pageId: 'events-explorer', label: 'Event inventory', icon: ListTree },
  { section: 'MVP KPIs (10)' },
  { to: '/mvp/dau', pageId: 'mvp.dau', label: '1. DAU', icon: Activity },
  { to: '/mvp/time-to-first-scan', pageId: 'mvp.time-to-first-scan', label: '2. Time to first scan', icon: Timer },
  { to: '/mvp/identify-success', pageId: 'mvp.identify-success', label: '3. Identify success', icon: ScanLine },
  { to: '/mvp/quota-hit', pageId: 'mvp.quota-hit', label: '4. Quota hit', icon: Target },
  { to: '/mvp/paywall', pageId: 'mvp.paywall', label: '5. Paywall → purchase', icon: PiggyBank },
  { to: '/mvp/retention', pageId: 'mvp.retention', label: '6. D1 / D7 retention', icon: TrendingUp },
  { to: '/mvp/scans-per-user', pageId: 'mvp.scans-per-user', label: '7. Scans / user', icon: Activity },
  { to: '/mvp/identify-funnel', pageId: 'mvp.identify-funnel', label: '8. Identify funnel', icon: Filter },
  { to: '/mvp/catalogue', pageId: 'mvp.catalogue', label: '9. Catalogue', icon: BookOpen },
  { to: '/mvp/marketplace', pageId: 'mvp.marketplace', label: '10. Marketplace', icon: ShoppingBag },
  { section: 'Explorer' },
  { to: '/dau', pageId: 'explorer.dau', label: 'Daily Active Users', icon: Activity },
  { to: '/mau', pageId: 'explorer.mau', label: 'Monthly Active Users', icon: Calendar },
  { to: '/new-users', pageId: 'explorer.new-users', label: 'New Users', icon: UserPlus },
  { to: '/d1-retention', pageId: 'explorer.d1', label: 'D1 Retention', icon: TrendingUp },
  { to: '/d7-retention', pageId: 'explorer.d7', label: 'D7 Retention', icon: TrendingUp },
  { to: '/countries', pageId: 'explorer.countries', label: 'Top Countries', icon: Globe },
  { to: '/platform', pageId: 'explorer.platform', label: 'Platform', icon: Smartphone },
  { to: '/events', pageId: 'explorer.events', label: 'Top Events', icon: BarChart3 },
  { section: 'Tools' },
  { to: '/sql', pageId: 'sql', label: 'SQL Editor', icon: Code2 },
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
          <div>
            <h1>{isCompare ? 'Compare Apps' : product.brand}</h1>
            <p>{isCompare ? 'Side-by-side comparison' : 'Product Analytics Dashboard'}</p>
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
                className={productId === p.id ? 'active' : ''}
                onClick={() => onSelectProduct(p.id)}
                title={p.brand}
              >
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
