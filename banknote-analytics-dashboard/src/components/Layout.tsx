import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
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
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchConfig, AppConfig } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { useProduct, type ProductId } from '@/lib/product';
import { useInvalidateDashboard } from '@/hooks/useAnalytics';
import { useAuth } from '@/lib/auth';

const NAV = [
  { section: 'Overview' },
  { to: '/', label: 'Home', icon: Home },
  { to: '/product', label: 'Product Analytics', icon: Sparkles },
  { to: '/compare', label: 'Compare Apps', icon: GitCompareArrows },
  { section: 'Funnels' },
  { to: '/funnels/identify', label: 'Identify', icon: ScanLine },
  { to: '/funnels/catalogue', label: 'Catalogue', icon: BookOpen },
  { to: '/funnels/marketplace', label: 'Marketplace', icon: ShoppingBag },
  { to: '/funnels/paywall', label: 'Paywall', icon: PiggyBank },
  { to: '/events-explorer', label: 'Event inventory', icon: ListTree },
  { section: 'MVP KPIs (10)' },
  { to: '/mvp/dau', label: '1. DAU', icon: Activity },
  { to: '/mvp/time-to-first-scan', label: '2. Time to first scan', icon: Timer },
  { to: '/mvp/identify-success', label: '3. Identify success', icon: ScanLine },
  { to: '/mvp/quota-hit', label: '4. Quota hit', icon: Target },
  { to: '/mvp/paywall', label: '5. Paywall → purchase', icon: PiggyBank },
  { to: '/mvp/retention', label: '6. D1 / D7 retention', icon: TrendingUp },
  { to: '/mvp/scans-per-user', label: '7. Scans / user', icon: Activity },
  { to: '/mvp/identify-funnel', label: '8. Identify funnel', icon: Filter },
  { to: '/mvp/catalogue', label: '9. Catalogue', icon: BookOpen },
  { to: '/mvp/marketplace', label: '10. Marketplace', icon: ShoppingBag },
  { section: 'Explorer' },
  { to: '/dau', label: 'Daily Active Users', icon: Activity },
  { to: '/mau', label: 'Monthly Active Users', icon: Calendar },
  { to: '/new-users', label: 'New Users', icon: UserPlus },
  { to: '/d1-retention', label: 'D1 Retention', icon: TrendingUp },
  { to: '/d7-retention', label: 'D7 Retention', icon: TrendingUp },
  { to: '/countries', label: 'Top Countries', icon: Globe },
  { to: '/platform', label: 'Platform', icon: Smartphone },
  { to: '/events', label: 'Top Events', icon: BarChart3 },
  { section: 'Tools' },
  { to: '/sql', label: 'SQL Editor', icon: Code2 },
];

export default function Layout() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { product, productId, isCompare, products, setProductId } = useProduct();
  const { user, logout } = useAuth();
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
            <button
              type="button"
              className={productId === 'compare' ? 'active' : ''}
              onClick={() => onSelectProduct('compare')}
            >
              Compare
            </button>
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
          {NAV.map((item, i) => {
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
          <button type="button" className="logout-btn" onClick={() => logout()}>
            <LogOut size={13} />
            Sign out{user ? ` (${user})` : ''}
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
