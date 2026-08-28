import { NavLink } from 'react-router-dom';
import {
  Users,
  UserPlus,
  TrendingUp,
  Globe,
  Smartphone,
  BarChart3,
  Calendar,
  Activity,
  Sparkles,
  GitCompareArrows,
  CircleDollarSign,
  ClipboardList,
  Clock,
  Gauge,
  ShieldAlert,
} from 'lucide-react';
import { useProduct } from '@/lib/product';
import { useAuth } from '@/lib/auth';
import { pageIdFromPath } from '@/lib/access';

const METRICS = [
  {
    to: '/product',
    icon: Sparkles,
    title: 'Product Analytics',
    description: 'Journey KPIs: Identify, limits, experiments, monetization, retention.',
  },
  {
    to: '/compare',
    icon: GitCompareArrows,
    title: 'Compare Apps',
    description: 'Banknote vs Coinzy side-by-side on the same MVP metrics.',
  },
  {
    to: '/report',
    icon: ClipboardList,
    title: 'Health report',
    description: 'Combined and per-app report: what is broken and what to pick first.',
  },
  {
    to: '/ltv',
    icon: CircleDollarSign,
    title: 'Cohort LTV',
    description: 'LTV-30 / 90 / 180 by country and organic / paid / direct installs.',
  },
  {
    to: '/dau',
    icon: Activity,
    title: 'Daily Active Users',
    description: 'Unique users per day over your selected date range.',
  },
  {
    to: '/mau',
    icon: Calendar,
    title: 'Monthly Active Users',
    description: 'Unique users per calendar month.',
  },
  {
    to: '/new-users',
    icon: UserPlus,
    title: 'New Users',
    description: 'First-time users by cohort date.',
  },
  {
    to: '/install-day-usage',
    icon: Clock,
    title: 'Installs + time used',
    description: 'How many people installed each day, how many stayed in the app, and for how long.',
  },
  {
    to: '/scan-limits',
    icon: Gauge,
    title: 'Scan limits',
    description: 'Free vs subscribed: who hit the successful-ID cap vs the unsuccessful-ID cap.',
  },
  {
    to: '/free-scan-quota',
    icon: ShieldAlert,
    title: 'Free-scan success quota',
    description: 'Coinzy experiment: hit = success remaining went to 0 (free_scan_success_quota_exhausted).',
    products: ['coinzy'],
  },
  {
    to: '/d1-retention',
    icon: TrendingUp,
    title: 'D1 Retention',
    description: 'Share of each cohort that returns the next day.',
  },
  {
    to: '/d7-retention',
    icon: TrendingUp,
    title: 'D7 Retention',
    description: 'Share of each cohort that returns after 7 days.',
  },
  {
    to: '/countries',
    icon: Globe,
    title: 'Top Countries',
    description: 'New users and DAU broken down by country.',
  },
  {
    to: '/platform',
    icon: Smartphone,
    title: 'Platform Split',
    description: 'Android vs iOS user distribution.',
  },
  {
    to: '/events',
    icon: BarChart3,
    title: 'Top Events',
    description: 'Most frequent Firebase Analytics events.',
  },
];

export default function HomePage() {
  const { product, productId } = useProduct();
  const { canAccessPage } = useAuth();
  const cards = METRICS.filter((m) => {
    const pageId = pageIdFromPath(m.to);
    if (pageId && !canAccessPage(pageId)) return false;
    if ('products' in m && Array.isArray(m.products) && !m.products.includes(productId)) {
      return false;
    }
    return true;
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h2>{product.brand} Analytics</h2>
          <p>
            {product.tagline} — Firebase → BigQuery. Switch Banknote / Coinzy and Light / Dark in the sidebar.
          </p>
        </div>
      </div>

      <div className="page-content">
        <div className="landing-hero centered">
          <Users size={32} strokeWidth={1.5} />
          <h3>Welcome</h3>
          <p>
            Track the shared journey <strong>Acquire → Onboard → Identify → Trust → Collect → Limit → Pro → Return</strong>
            {' '}for {product.shortName}. Start with <NavLink to="/product" style={{ color: 'var(--accent)' }}>Product Analytics</NavLink> for MVP KPIs and explanations.
          </p>
          <p>
            Metric tabs read pre-aggregated summary tables where available — fast and low-cost.
            No data loads on this page until you open a metric.
          </p>
        </div>

        <div className="landing-grid">
          {cards.map(({ to, icon: Icon, title, description }) => (
            <NavLink key={to} to={to} className="landing-card">
              <Icon size={20} aria-hidden />
              <div>
                <strong>{title}</strong>
                <span>{description}</span>
              </div>
            </NavLink>
          ))}
        </div>

        <div className="landing-notes">
          <h4>Banknote + Coinzy</h4>
          <ul>
            <li>Same query structure and MVP KPIs for both products.</li>
            <li>Diffs are mostly entity language (<code>banknote_id</code> vs <code>coin_id</code>) and <code>app_name</code>.</li>
            <li>Use the product switcher in the sidebar; theme preference is saved locally.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
