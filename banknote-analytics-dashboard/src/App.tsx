import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import HomePage from '@/pages/HomePage';
import ProductAnalyticsPage from '@/pages/ProductAnalyticsPage';
import ComparePage from '@/pages/ComparePage';
import MetricPage, { METRIC_CONFIGS } from '@/pages/MetricPage';
import SqlEditorPage from '@/pages/SqlEditorPage';
import FunnelPage from '@/pages/FunnelPage';
import EventsExplorerPage from '@/pages/EventsExplorerPage';
import LtvPage from '@/pages/LtvPage';
import UserMixPage from '@/pages/UserMixPage';
import InstallDayUsagePage from '@/pages/InstallDayUsagePage';
import ScanLimitsPage from '@/pages/ScanLimitsPage';
import ReportPage from '@/pages/ReportPage';
import LoginPage from '@/pages/LoginPage';
import AdminUsersPage from '@/pages/AdminUsersPage';
import { defaultDateRange, QueryParams } from '@/lib/api';
import { useInvalidateDashboard } from '@/hooks/useAnalytics';
import { useAuth } from '@/lib/auth';

type Shared = {
  params: QueryParams;
  setParams: (p: QueryParams) => void;
  applyFilters: () => void;
};

const FUNNELS = [
  'identify',
  'identify-nav',
  'identify-home',
  'identify-camera',
  'identify-gallery',
  'catalogue',
  'collection',
  'global',
  'marketplace',
  'feed',
  'paywall',
  'paywall-onboarding',
  'expert',
] as const;

/** path → MetricPage config key */
const METRIC_ROUTES: [string, keyof typeof METRIC_CONFIGS][] = [
  ['mvp/dau', 'mvp-dau'],
  ['mvp/time-to-first-scan', 'mvp-time-to-first-scan'],
  ['mvp/identify-success', 'mvp-identify-success'],
  ['mvp/quota-hit', 'mvp-quota-hit'],
  ['mvp/paywall', 'mvp-paywall'],
  ['mvp/retention', 'mvp-retention'],
  ['mvp/scans-per-user', 'mvp-scans-per-user'],
  ['mvp/identify-funnel', 'mvp-identify-funnel'],
  ['mvp/catalogue', 'mvp-catalogue'],
  ['mvp/marketplace', 'mvp-marketplace'],
  ['dau', 'dau'],
  ['mau', 'mau'],
  ['new-users', 'new-users'],
  ['d1-retention', 'd1'],
  ['d7-retention', 'd7'],
  ['countries', 'countries'],
  ['platform', 'platform'],
  ['events', 'events'],
];

function MetricRoute({
  metricKey,
  ...shared
}: { metricKey: keyof typeof METRIC_CONFIGS } & Shared) {
  return <MetricPage config={METRIC_CONFIGS[metricKey]} {...shared} />;
}

export default function App() {
  const { loading, authenticated } = useAuth();
  const [params, setParams] = useState<QueryParams>(defaultDateRange(30));
  const invalidate = useInvalidateDashboard();
  const shared: Shared = { params, setParams, applyFilters: () => invalidate() };

  if (loading) {
    return (
      <div className="login-screen">
        <div className="login-card">Loading…</div>
      </div>
    );
  }
  if (!authenticated) return <LoginPage />;

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="product" element={<ProductAnalyticsPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="report" element={<ReportPage {...shared} />} />
        {FUNNELS.map((id) => (
          <Route key={id} path={`funnels/${id}`} element={<FunnelPage funnelId={id} {...shared} />} />
        ))}
        <Route path="events-explorer" element={<EventsExplorerPage {...shared} />} />
        {METRIC_ROUTES.map(([path, metricKey]) => (
          <Route key={path} path={path} element={<MetricRoute metricKey={metricKey} {...shared} />} />
        ))}
        <Route path="ltv" element={<LtvPage {...shared} />} />
        <Route path="user-mix" element={<UserMixPage {...shared} />} />
        <Route path="install-day-usage" element={<InstallDayUsagePage {...shared} />} />
        <Route path="scan-limits" element={<ScanLimitsPage {...shared} />} />
        <Route path="sql" element={<SqlEditorPage {...shared} />} />
        <Route path="admin/users" element={<AdminUsersPage />} />
      </Route>
    </Routes>
  );
}
