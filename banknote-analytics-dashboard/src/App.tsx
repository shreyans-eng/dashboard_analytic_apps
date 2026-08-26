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
import LoginPage from '@/pages/LoginPage';
import AdminUsersPage from '@/pages/AdminUsersPage';
import { defaultDateRange, QueryParams } from '@/lib/api';
import { useInvalidateDashboard } from '@/hooks/useAnalytics';
import { useAuth } from '@/lib/auth';

function MetricRoute({ metricKey, ...shared }: { metricKey: keyof typeof METRIC_CONFIGS } & {
  params: QueryParams;
  setParams: (p: QueryParams) => void;
  applyFilters: () => void;
}) {
  return <MetricPage config={METRIC_CONFIGS[metricKey]} {...shared} />;
}

export default function App() {
  const { loading, authenticated } = useAuth();
  const [params, setParams] = useState<QueryParams>(defaultDateRange(30));
  const invalidate = useInvalidateDashboard();
  const applyFilters = () => invalidate();
  const shared = { params, setParams, applyFilters };

  if (loading) {
    return <div className="login-screen"><div className="login-card">Loading…</div></div>;
  }
  if (!authenticated) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="product" element={<ProductAnalyticsPage />} />
        <Route path="compare" element={<ComparePage />} />

        {/* Funnels */}
        <Route path="funnels/identify" element={<FunnelPage funnelId="identify" {...shared} />} />
        <Route path="funnels/catalogue" element={<FunnelPage funnelId="catalogue" {...shared} />} />
        <Route path="funnels/marketplace" element={<FunnelPage funnelId="marketplace" {...shared} />} />
        <Route path="funnels/paywall" element={<FunnelPage funnelId="paywall" {...shared} />} />
        <Route path="events-explorer" element={<EventsExplorerPage {...shared} />} />

        {/* MVP product KPIs (10) */}
        <Route path="mvp/dau" element={<MetricRoute metricKey="mvp-dau" {...shared} />} />
        <Route path="mvp/time-to-first-scan" element={<MetricRoute metricKey="mvp-time-to-first-scan" {...shared} />} />
        <Route path="mvp/identify-success" element={<MetricRoute metricKey="mvp-identify-success" {...shared} />} />
        <Route path="mvp/quota-hit" element={<MetricRoute metricKey="mvp-quota-hit" {...shared} />} />
        <Route path="mvp/paywall" element={<MetricRoute metricKey="mvp-paywall" {...shared} />} />
        <Route path="mvp/retention" element={<MetricRoute metricKey="mvp-retention" {...shared} />} />
        <Route path="mvp/scans-per-user" element={<MetricRoute metricKey="mvp-scans-per-user" {...shared} />} />
        <Route path="mvp/identify-funnel" element={<MetricRoute metricKey="mvp-identify-funnel" {...shared} />} />
        <Route path="mvp/catalogue" element={<MetricRoute metricKey="mvp-catalogue" {...shared} />} />
        <Route path="mvp/marketplace" element={<MetricRoute metricKey="mvp-marketplace" {...shared} />} />

        {/* Executive / explorer tabs */}
        <Route path="ltv" element={<LtvPage {...shared} />} />
        <Route path="dau" element={<MetricRoute metricKey="dau" {...shared} />} />
        <Route path="mau" element={<MetricRoute metricKey="mau" {...shared} />} />
        <Route path="new-users" element={<MetricRoute metricKey="new-users" {...shared} />} />
        <Route path="d1-retention" element={<MetricRoute metricKey="d1" {...shared} />} />
        <Route path="d7-retention" element={<MetricRoute metricKey="d7" {...shared} />} />
        <Route path="countries" element={<MetricRoute metricKey="countries" {...shared} />} />
        <Route path="platform" element={<MetricRoute metricKey="platform" {...shared} />} />
        <Route path="events" element={<MetricRoute metricKey="events" {...shared} />} />
        <Route path="sql" element={<SqlEditorPage params={params} />} />
        <Route path="admin/users" element={<AdminUsersPage />} />
      </Route>
    </Routes>
  );
}

