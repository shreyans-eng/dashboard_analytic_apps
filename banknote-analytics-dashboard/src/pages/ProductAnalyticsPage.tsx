import { NavLink } from 'react-router-dom';
import {
  Activity,
  Camera,
  Filter,
  Layers,
  PiggyBank,
  RefreshCw,
  ScanLine,
  ShoppingBag,
  Sparkles,
  Target,
  Users,
  BookOpen,
} from 'lucide-react';
import { useProduct } from '@/lib/product';

/**
 * Product Analytics Focus
 * Journey: Acquire → Onboard → Identify → Trust → Collect → Limit → Pro → Return
 * MVP = 10 KPIs (free-scan variant removed; funnel + catalogue + marketplace added)
 */
const AREAS = [
  {
    id: 'growth',
    label: 'Growth',
    title: 'Acquire & onboard',
    icon: Users,
    to: '/mvp/dau',
    why: 'Top of funnel. Marketing and store listing must bring users who can reach Identify.',
    metrics: 'DAU · Installs / first_open · Attribution (utm) · Onboarding completion',
  },
  {
    id: 'identify',
    label: 'Identify',
    title: 'Core product value + funnel',
    icon: ScanLine,
    to: '/mvp/identify-funnel',
    why: 'Aha = first successful ID. Funnel shows where it breaks (permission → photo → submit → result).',
    metrics: 'Time to first scan · Funnel conversion · Success / failure · No-match',
  },
  {
    id: 'limits',
    label: 'Free limits',
    title: 'Quota pressure',
    icon: Target,
    to: '/mvp/quota-hit',
    why: 'Too early → angry churn. Too late → weak Pro pressure. Track hits and post-limit behavior.',
    metrics: 'Quota hit rate · Post-limit paywall views',
  },
  {
    id: 'monetization',
    label: 'Monetization',
    title: 'Paywall → Pro',
    icon: PiggyBank,
    to: '/mvp/paywall',
    why: 'Separates traffic from conversion. Pack mix and fails/cancels diagnose pricing vs store friction.',
    metrics: 'Paywall → purchase · Pack mix · Cohort LTV-30/90/180',
  },
  {
    id: 'retention',
    label: 'Retention',
    title: 'Come back & deepen',
    icon: RefreshCw,
    to: '/mvp/retention',
    why: 'Collector return rate is PMF. Pair with scans/user so DAU growth is not shallow opens.',
    metrics: 'D1 / D7 / D30 · Scans per active user',
  },
  {
    id: 'catalogue',
    label: 'Catalogue',
    title: 'Browse & detail',
    icon: BookOpen,
    to: '/mvp/catalogue',
    why: 'Catalogue/collection opens and detail views — second product surface after Identify.',
    metrics: 'Catalogue open rate · Detail views · Filters',
  },
  {
    id: 'collection',
    label: 'Collection',
    title: 'Identify → habit',
    icon: Layers,
    to: '/mvp/catalogue',
    why: 'Add-to-collection after successful ID. One-off tool vs collecting habit.',
    metrics: 'Add-after-ID rate · Collection engagement',
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    title: 'Commerce loop',
    icon: ShoppingBag,
    to: '/mvp/marketplace',
    why: 'Listing views and contact seller — commerce stickiness once core Identify is healthy.',
    metrics: 'Marketplace engagement · Contact seller',
  },
  {
    id: 'feed',
    label: 'Feed',
    title: 'Secondary social',
    icon: Filter,
    to: '/product',
    why: 'Posts / likes — secondary engagement after Identify + Pro + catalogue are healthy.',
    metrics: 'Feed open · Posts · Likes',
  },
];

const MVP = [
  {
    name: 'DAU',
    why: 'Baseline health. Every other rate is relative to active users.',
    to: '/mvp/dau',
  },
  {
    name: 'Time to first scan',
    why: 'Core aha. Longer = friction (permission, camera, paywall, confusion).',
    to: '/mvp/time-to-first-scan',
  },
  {
    name: 'Identification success rate',
    why: 'Direct quality signal for AI + photo UX.',
    to: '/mvp/identify-success',
  },
  {
    name: 'Quota hit rate',
    why: 'Are free limits pushing Pro without killing usage?',
    to: '/mvp/quota-hit',
  },
  {
    name: 'Paywall → purchase',
    why: 'Monetization conversion — pricing, copy, or timing.',
    to: '/mvp/paywall',
  },
  {
    name: 'D1 / D7 retention',
    why: 'Do users return after the first scan? Collector PMF.',
    to: '/mvp/retention',
  },
  {
    name: 'Scans per active user',
    why: 'Engagement intensity. Rising DAU + falling scans = shallow opens.',
    to: '/mvp/scans-per-user',
  },
  {
    name: 'Identify funnel conversion',
    why: 'Open → permission → photo → submit → success. Shows where Identify breaks.',
    to: '/mvp/identify-funnel',
  },
  {
    name: 'Catalogue / collection engagement',
    why: 'Catalogue opens, detail views, add-after-ID — habit beyond a single scan.',
    to: '/mvp/catalogue',
  },
  {
    name: 'Marketplace engagement',
    why: 'Listing / market usage and contact seller — commerce loop health.',
    to: '/mvp/marketplace',
  },
];

export default function ProductAnalyticsPage() {
  const { product, products, isCompare } = useProduct();
  const others = products.filter((p) => p.id !== product.id);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Product Analytics — {isCompare ? 'All apps' : product.brand}</h2>
          <p>
            Measure outcomes across the journey
            {isCompare ? '' : ` for ${product.shortName}`}: {product.tagline}
          </p>
        </div>
      </div>

      <div className="page-content">
        <div className="landing-hero">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Sparkles size={22} strokeWidth={1.5} color="var(--accent)" />
            <h3 style={{ margin: 0 }}>Goal</h3>
          </div>
          <p>
            Measure <strong>product outcomes</strong> across the journey — not vanity event counts.
          </p>
          <div className="journey-strip">
            {product.journey.map((step) => (
              <span key={step} className="journey-chip">
                {step}
              </span>
            ))}
          </div>
          <p style={{ marginTop: 14 }}>
            MVP is <strong>10 KPIs</strong>. Free-scan variant comparison was removed.
            Use the sidebar <strong>MVP KPIs (10)</strong> section for live charts per app.
            Added: <strong>Identify funnel</strong>, <strong>catalogue</strong>, and <strong>marketplace</strong>.
          </p>
        </div>

        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Key areas</h3>
        <div className="area-grid">
          {AREAS.map(({ id, label, title, icon: Icon, why, metrics, to }) => (
            <NavLink key={id} to={to} className="area-card" style={{ display: 'block' }}>
              <div className="area-label">{label}</div>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon size={16} color="var(--accent)" />
                {title}
              </h4>
              <p>{why}</p>
              <div className="metrics">{metrics}</div>
            </NavLink>
          ))}
        </div>

        <div className="section-card">
          <h3>MVP KPIs — 10 metrics</h3>
          <p>
            Answers: <em>Are we growing? Do people get value through Identify? Do free limits push Pro?
            Do catalogue and marketplace deepen the habit?</em>
          </p>
          <div className="mvp-list">
            {MVP.map((item, i) => (
              <NavLink key={item.name} to={item.to} className="mvp-item" style={{ display: 'flex' }}>
                <div className="n">{i + 1}</div>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.why}</span>
                </div>
              </NavLink>
            ))}
          </div>
          <p style={{ marginTop: 12 }}>
            Cohort LTV-30 / 90 / 180 by country and organic / paid / direct is under Explorer:{' '}
            <NavLink to="/ltv" style={{ color: 'var(--accent)' }}>Cohort LTV</NavLink>.
            Date filters there are install dates, not calendar revenue.
          </p>
        </div>

        <div className="section-card">
          <h3>
            <Camera size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Multi-app setup
          </h3>
          <p>
            Switch apps in the sidebar to inspect each separately. SQL under{' '}
            <code>sql/dashboard/product/01</code>–<code>10</code> is shared;
            entity params differ per app. Use{' '}
            <NavLink to="/compare" style={{ color: 'var(--accent)' }}>Compare Apps</NavLink> for side-by-side.
          </p>
          <p style={{ marginTop: 8 }}>
            Registered apps: {products.map((p) => p.shortName).join(', ')}
            {others.length ? ` · Others vs ${product.shortName}: ${others.map((o) => o.shortName).join(', ')}` : ''}
          </p>
          <table className="diff-table">
            <thead>
              <tr>
                <th>Area</th>
                <th>Banknote</th>
                <th>Coinzy</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Entity</td>
                <td>Banknote / paper money</td>
                <td>Coin</td>
                <td>Same Identify → Collect loop</td>
              </tr>
              <tr>
                <td>ID param</td>
                <td><code>banknote_id</code></td>
                <td><code>coin_id</code></td>
                <td>Views accept both where needed</td>
              </tr>
              <tr>
                <td>MVP SQL</td>
                <td colSpan={2}><code>sql/dashboard/product/01–10_*.sql</code></td>
                <td>Identical formulas</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="section-card">
          <h3>
            <Activity size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            How to read decisions
          </h3>
          <ul>
            <li>High installs, low first-scan → fix onboarding / camera / CTA to Identify.</li>
            <li>Funnel drop at permission or photo → UX / permission timing.</li>
            <li>Low success rate → photo guidance, lighting, model quality.</li>
            <li>Quota hit early + churn → raise free limit or improve paywall timing.</li>
            <li>Strong Identify, weak catalogue/collection → post-ID browse / add CTA.</li>
            <li>Strong Identify, weak marketplace → listing discovery / commerce entry.</li>
            <li>Rising DAU, falling scans/user → shallow opens, not growth success.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
