import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import FilterBar from '@/components/FilterBar';
import ChartCard from '@/components/ChartCard';
import { useDashboardMetric } from '@/hooks/useAnalytics';
import { fmtPercent, QueryParams } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { useProduct } from '@/lib/product';

export type MetricId =
  | 'dau'
  | 'mau'
  | 'new-users'
  | 'd1'
  | 'd7'
  | 'countries'
  | 'platform'
  | 'events'
  | 'mvp-dau'
  | 'mvp-time-to-first-scan'
  | 'mvp-identify-success'
  | 'mvp-quota-hit'
  | 'mvp-paywall'
  | 'mvp-retention'
  | 'mvp-scans-per-user'
  | 'mvp-identify-funnel'
  | 'mvp-catalogue'
  | 'mvp-marketplace';

export interface MetricConfig {
  id: MetricId;
  title: string;
  subtitle: string;
  chartTitle: string;
  type: 'line' | 'bar' | 'bar-h' | 'pie';
  xKey: string;
  yKey: string;
  color: string;
  percent?: boolean;
  pieNameKey?: string;
  limit?: number;
}

interface Props {
  config: MetricConfig;
  params: QueryParams;
  setParams: (p: QueryParams) => void;
  applyFilters: () => void;
}

const PIE_COLORS = ['#4f8cff', '#34d399', '#fbbf24', '#f87171'];

function formatXTick(value: unknown, xKey: string) {
  const v = String(value);
  if (xKey === 'activity_month') return v.slice(0, 7);
  if (xKey.includes('date')) return v.slice(5);
  return v;
}

export default function MetricPage({ config, params, setParams, applyFilters }: Props) {
  const query = useDashboardMetric(config.id, params);
  const rows = query.data ?? [];
  const { chart } = useTheme();
  const { product } = useProduct();
  const tipStyle = {
    background: chart.tooltipBg,
    border: `1px solid ${chart.tooltipBorder}`,
    color: 'var(--text)',
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>{config.title}</h2>
          <p>{config.subtitle} · {product.shortName}</p>
        </div>
        <FilterBar params={params} onChange={setParams} onApply={applyFilters} />
      </div>

      <div className="page-content">
        <div className="chart-grid">
          <ChartCard
            title={config.chartTitle}
            loading={query.isLoading}
            error={query.error?.message}
          >
            <ResponsiveContainer width="100%" height={420}>
              {config.type === 'line' && (
                <LineChart data={rows}>
                  <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" />
                  <XAxis
                    dataKey={config.xKey}
                    tick={{ fill: chart.tick, fontSize: 11 }}
                    tickFormatter={(v) => formatXTick(v, config.xKey)}
                  />
                  <YAxis
                    tick={{ fill: chart.tick, fontSize: 11 }}
                    tickFormatter={config.percent ? (v) => `${(Number(v) * 100).toFixed(0)}%` : undefined}
                  />
                  <Tooltip
                    formatter={config.percent ? (v: number) => fmtPercent(v) : undefined}
                    contentStyle={tipStyle}
                  />
                  <Line type="monotone" dataKey={config.yKey} stroke={config.color} strokeWidth={2} dot={false} />
                </LineChart>
              )}

              {config.type === 'bar' && (
                <BarChart data={rows}>
                  <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" />
                  <XAxis
                    dataKey={config.xKey}
                    tick={{ fill: chart.tick, fontSize: 11 }}
                    tickFormatter={(v) => formatXTick(v, config.xKey)}
                  />
                  <YAxis tick={{ fill: chart.tick, fontSize: 11 }} />
                  <Tooltip contentStyle={tipStyle} />
                  <Bar dataKey={config.yKey} fill={config.color} radius={[4, 4, 0, 0]} />
                </BarChart>
              )}

              {config.type === 'bar-h' && (
                <BarChart data={rows.slice(0, config.limit ?? 15)} layout="vertical">
                  <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fill: chart.tick, fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey={config.xKey}
                    width={config.id === 'events' ? 200 : 90}
                    tick={{ fill: chart.tick, fontSize: 10 }}
                  />
                  <Tooltip contentStyle={tipStyle} />
                  <Bar dataKey={config.yKey} fill={config.color} radius={[0, 4, 4, 0]} />
                </BarChart>
              )}

              {config.type === 'pie' && (
                <PieChart>
                  <Pie
                    data={rows}
                    dataKey={config.yKey}
                    nameKey={config.pieNameKey ?? config.xKey}
                    cx="50%"
                    cy="50%"
                    outerRadius={140}
                    label
                  >
                    {rows.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tipStyle} />
                </PieChart>
              )}
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
    </>
  );
}

export const METRIC_CONFIGS: Record<string, MetricConfig> = {
  dau: {
    id: 'dau',
    title: 'Daily Active Users',
    subtitle: 'Unique users per day',
    chartTitle: 'DAU trend',
    type: 'line',
    xKey: 'event_date',
    yKey: 'dau',
    color: '#4f8cff',
  },
  mau: {
    id: 'mau',
    title: 'Monthly Active Users',
    subtitle: 'Unique users per month',
    chartTitle: 'MAU by month',
    type: 'bar',
    xKey: 'activity_month',
    yKey: 'mau',
    color: '#34d399',
  },
  'new-users': {
    id: 'new-users',
    title: 'New Users',
    subtitle: 'First-time users by cohort date',
    chartTitle: 'New users over time',
    type: 'line',
    xKey: 'cohort_date',
    yKey: 'new_users',
    color: '#fbbf24',
  },
  d1: {
    id: 'd1',
    title: 'D1 Retention',
    subtitle: 'Day-1 cohort retention rate',
    chartTitle: 'D1 retention by cohort',
    type: 'line',
    xKey: 'cohort_date',
    yKey: 'd1_retention_rate',
    color: '#a78bfa',
    percent: true,
  },
  d7: {
    id: 'd7',
    title: 'D7 Retention',
    subtitle: 'Day-7 cohort retention rate',
    chartTitle: 'D7 retention by cohort',
    type: 'line',
    xKey: 'cohort_date',
    yKey: 'd7_retention_rate',
    color: '#f87171',
    percent: true,
  },
  countries: {
    id: 'countries',
    title: 'Top Countries',
    subtitle: 'New users by country (selected range)',
    chartTitle: 'Top countries',
    type: 'bar-h',
    xKey: 'country',
    yKey: 'total_new_users',
    color: '#4f8cff',
  },
  platform: {
    id: 'platform',
    title: 'Platform Split',
    subtitle: 'Users by Android / iOS',
    chartTitle: 'Platform breakdown',
    type: 'pie',
    xKey: 'platform',
    yKey: 'unique_users',
    color: '#34d399',
    pieNameKey: 'platform',
  },
  events: {
    id: 'events',
    title: 'Top Events',
    subtitle: 'Most frequent Firebase events',
    chartTitle: 'Top 25 events',
    type: 'bar-h',
    xKey: 'event_name_base',
    yKey: 'event_count',
    color: '#34d399',
    limit: 25,
  },

  // —— MVP product KPIs (10) ——
  'mvp-dau': {
    id: 'mvp-dau',
    title: 'MVP 1 · DAU',
    subtitle: 'Daily active users — baseline health',
    chartTitle: 'DAU over time',
    type: 'line',
    xKey: 'event_date',
    yKey: 'dau',
    color: '#4f8cff',
  },
  'mvp-time-to-first-scan': {
    id: 'mvp-time-to-first-scan',
    title: 'MVP 2 · Time to first scan',
    subtitle: 'Day-0 first successful identify rate (views required for median seconds)',
    chartTitle: 'Day-0 first scan rate',
    type: 'line',
    xKey: 'event_date',
    yKey: 'day0_first_scan_rate',
    color: '#22d3ee',
    percent: true,
  },
  'mvp-identify-success': {
    id: 'mvp-identify-success',
    title: 'MVP 3 · Identify success',
    subtitle: 'success ÷ (success + failure)',
    chartTitle: 'Identification success rate',
    type: 'line',
    xKey: 'event_date',
    yKey: 'identification_success_rate',
    color: '#34d399',
    percent: true,
  },
  'mvp-quota-hit': {
    id: 'mvp-quota-hit',
    title: 'MVP 4 · Quota hit rate',
    subtitle: 'Users hitting free limit ÷ users who attempted a scan',
    chartTitle: 'Free quota hit rate',
    type: 'line',
    xKey: 'event_date',
    yKey: 'free_quota_hit_rate',
    color: '#fbbf24',
    percent: true,
  },
  'mvp-paywall': {
    id: 'mvp-paywall',
    title: 'MVP 5 · Paywall → purchase',
    subtitle: 'Subs_confirm ÷ paywall impressions',
    chartTitle: 'Paywall conversion',
    type: 'line',
    xKey: 'event_date',
    yKey: 'paywall_to_confirm_rate',
    color: '#a78bfa',
    percent: true,
  },
  'mvp-retention': {
    id: 'mvp-retention',
    title: 'MVP 6 · D1 / D7 retention',
    subtitle: 'Cohort return rates (chart shows D1; D7 in same series data)',
    chartTitle: 'D1 retention by cohort',
    type: 'line',
    xKey: 'cohort_date',
    yKey: 'd1_retention_rate',
    color: '#f87171',
    percent: true,
  },
  'mvp-scans-per-user': {
    id: 'mvp-scans-per-user',
    title: 'MVP 7 · Scans per user',
    subtitle: 'Successful identifies ÷ DAU',
    chartTitle: 'Scans per DAU',
    type: 'line',
    xKey: 'event_date',
    yKey: 'scans_per_dau',
    color: '#fb7185',
  },
  'mvp-identify-funnel': {
    id: 'mvp-identify-funnel',
    title: 'MVP 8 · Identify funnel',
    subtitle: 'Open → success conversion',
    chartTitle: 'Open to success rate',
    type: 'line',
    xKey: 'event_date',
    yKey: 'open_to_success_rate',
    color: '#4f8cff',
    percent: true,
  },
  'mvp-catalogue': {
    id: 'mvp-catalogue',
    title: 'MVP 9 · Catalogue / collection',
    subtitle: 'Catalogue open rate among DAU',
    chartTitle: 'Catalogue engagement',
    type: 'line',
    xKey: 'event_date',
    yKey: 'catalogue_open_rate',
    color: '#34d399',
    percent: true,
  },
  'mvp-marketplace': {
    id: 'mvp-marketplace',
    title: 'MVP 10 · Marketplace',
    subtitle: 'Marketplace / listing engagement among DAU',
    chartTitle: 'Marketplace engagement',
    type: 'line',
    xKey: 'event_date',
    yKey: 'marketplace_engagement_rate',
    color: '#fbbf24',
    percent: true,
  },
};
