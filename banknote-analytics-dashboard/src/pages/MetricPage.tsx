import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import FilterBar from '@/components/FilterBar';
import ChartCard from '@/components/ChartCard';
import { useDashboardMetric, useDashboardStatus } from '@/hooks/useAnalytics';
import { fmtNumber, fmtPercent, QueryParams } from '@/lib/api';
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

export interface ExtraChart {
  title: string;
  yKey: string;
  color: string;
  percent?: boolean;
  type?: 'line' | 'bar';
}

export interface MetricStat {
  key: string;
  label: string;
  format?: 'number' | 'percent' | 'seconds';
}

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
  extraCharts?: ExtraChart[];
  stats?: MetricStat[];
  guide?: string;
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

function fmtDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function sumKey(rows: Record<string, unknown>[], key: string) {
  return rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
}

function statValue(rows: Record<string, unknown>[], stat: MetricStat) {
  if (!rows.length) return '—';
  if (stat.format === 'percent' && stat.key === 'day0_first_scan_rate') {
    const installs = sumKey(rows, 'cohort_users');
    const scanned = sumKey(rows, 'users_scanned_day0');
    return installs > 0 ? fmtPercent(scanned / installs) : '—';
  }
  if (stat.format === 'seconds') {
    const vals = rows
      .map((r) => Number(r[stat.key]))
      .filter((n) => Number.isFinite(n) && n >= 0);
    if (!vals.length) return '—';
    return fmtDuration(vals.reduce((a, b) => a + b, 0) / vals.length);
  }
  if (stat.format === 'percent') {
    const vals = rows.map((r) => Number(r[stat.key])).filter((n) => Number.isFinite(n));
    if (!vals.length) return '—';
    return fmtPercent(vals.reduce((a, b) => a + b, 0) / vals.length);
  }
  return fmtNumber(sumKey(rows, stat.key));
}

export default function MetricPage({ config, params, setParams, applyFilters }: Props) {
  const query = useDashboardMetric(config.id, params);
  const status = useDashboardStatus();
  const rows = query.data ?? [];
  const { chart } = useTheme();
  const { product } = useProduct();
  const tipStyle = {
    background: chart.tooltipBg,
    border: `1px solid ${chart.tooltipBorder}`,
    color: 'var(--text)',
  };
  const latestComplete = status.data?.latestCompleteDate || null;
  const endDate = params.end_date || '';
  const incomplete =
    Boolean(latestComplete && endDate && endDate > latestComplete);
  const isDau = config.yKey === 'dau';
  const emptyCompleteRange = !query.isLoading && !query.error && rows.length === 0;

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
        {incomplete && (
          <p className="export-note">
            Complete numbers are available through <strong>{latestComplete}</strong>.
            Later dates are not ready yet — they are missing, not zero activity.
          </p>
        )}
        {config.guide && (
          <div className="page-hint" style={{ marginBottom: 16 }}>
            {config.guide}
          </div>
        )}
        {config.stats && rows.length > 0 && (
          <div className="kpi-row">
            {config.stats.map((stat) => (
              <div key={stat.key} className="kpi-card">
                <div className="label">{stat.label}</div>
                <div className="value">{statValue(rows as Record<string, unknown>[], stat)}</div>
              </div>
            ))}
          </div>
        )}
        <div className="chart-grid">
          <ChartCard
            title={config.chartTitle}
            loading={query.isLoading}
            error={query.error?.message}
          >
            {emptyCompleteRange ? (
              <div className="empty-data">
                {isDau && incomplete && (!params.start_date || params.start_date > latestComplete)
                  ? 'Data unavailable — this range is after the latest complete Firebase daily export.'
                  : 'No matching data in this range.'}
              </div>
            ) : (
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
            )}
          </ChartCard>
          {(config.extraCharts || []).map((extra) => (
            <ChartCard
              key={extra.yKey}
              title={extra.title}
              loading={query.isLoading}
              error={query.error?.message}
            >
              {emptyCompleteRange ? (
                <div className="empty-data">No matching data in this range.</div>
              ) : extra.type === 'bar' ? (
                <ResponsiveContainer width="100%" height={420}>
                  <BarChart data={rows}>
                    <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" />
                    <XAxis
                      dataKey={config.xKey}
                      tick={{ fill: chart.tick, fontSize: 11 }}
                      tickFormatter={(v) => formatXTick(v, config.xKey)}
                    />
                    <YAxis tick={{ fill: chart.tick, fontSize: 11 }} />
                    <Tooltip contentStyle={tipStyle} />
                    <Legend />
                    <Bar dataKey="cohort_users" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Installs" />
                    <Bar dataKey="users_scanned_day0" fill={extra.color} radius={[4, 4, 0, 0]} name="Scanned day 0" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={420}>
                  <LineChart data={rows}>
                    <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" />
                    <XAxis
                      dataKey={config.xKey}
                      tick={{ fill: chart.tick, fontSize: 11 }}
                      tickFormatter={(v) => formatXTick(v, config.xKey)}
                    />
                    <YAxis
                      tick={{ fill: chart.tick, fontSize: 11 }}
                      tickFormatter={extra.percent ? (v) => `${(Number(v) * 100).toFixed(0)}%` : undefined}
                    />
                    <Tooltip
                      formatter={extra.percent ? (v: number) => fmtPercent(v) : undefined}
                      contentStyle={tipStyle}
                    />
                    <Line type="monotone" dataKey={extra.yKey} stroke={extra.color} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          ))}
        </div>
      </div>
    </>
  );
}

export const METRIC_CONFIGS: Record<string, MetricConfig> = {
  dau: {
    id: 'dau',
    title: 'Daily Active Users',
    subtitle: 'How many people opened the app each day',
    chartTitle: 'People who opened the app each day',
    type: 'line',
    xKey: 'event_date',
    yKey: 'dau',
    color: '#4f8cff',
    guide: 'A person counts if they opened the app or started a session that day (session_start, App_open, first_open). Receiving or displaying a notification does not count as DAU.',
  },
  mau: {
    id: 'mau',
    title: 'Monthly Active Users',
    subtitle: 'How many people used the app in each calendar month',
    chartTitle: 'People who used the app each month',
    type: 'bar',
    xKey: 'activity_month',
    yKey: 'mau',
    color: '#34d399',
    guide: 'Same idea as daily users, but for a whole month. Someone who opened the app twice in March still counts as one person for March.',
  },
  'new-users': {
    id: 'new-users',
    title: 'New Users',
    subtitle: 'How many people installed / opened for the first time each day',
    chartTitle: 'First-time people over time',
    type: 'line',
    xKey: 'cohort_date',
    yKey: 'new_users',
    color: '#fbbf24',
    guide: 'Each person is placed on the day they first opened the app. This is new people, not returning people.',
  },
  d1: {
    id: 'd1',
    title: 'Came back the next day',
    subtitle: 'Of people who installed on a day, what share opened the app again the next day',
    chartTitle: 'Came back the next day',
    type: 'line',
    xKey: 'cohort_date',
    yKey: 'd1_retention_rate',
    color: '#a78bfa',
    percent: true,
    guide: 'If 100 people installed on Monday and 30 opened the app on Tuesday, this is 30%. Higher is better — it means the first session was worth coming back for.',
  },
  d7: {
    id: 'd7',
    title: 'Came back after a week',
    subtitle: 'Of people who installed on a day, what share opened the app again 7 days later',
    chartTitle: 'Came back after 7 days',
    type: 'line',
    xKey: 'cohort_date',
    yKey: 'd7_retention_rate',
    color: '#f87171',
    percent: true,
    guide: 'Same as “came back the next day”, but a week later. Recent days may be empty until a week has passed.',
  },
  countries: {
    id: 'countries',
    title: 'Top Countries',
    subtitle: 'Where new people are coming from',
    chartTitle: 'New people by country',
    type: 'bar-h',
    xKey: 'country',
    yKey: 'total_new_users',
    color: '#4f8cff',
    guide: 'Counts first-time people in the date range, grouped by country.',
  },
  platform: {
    id: 'platform',
    title: 'Android vs iPhone',
    subtitle: 'Which phones people use',
    chartTitle: 'People by phone type',
    type: 'pie',
    xKey: 'platform',
    yKey: 'unique_users',
    color: '#34d399',
    pieNameKey: 'platform',
    guide: 'Share of people on Android versus iPhone in this date range.',
  },
  events: {
    id: 'events',
    title: 'What people do most',
    subtitle: 'The actions the app records most often',
    chartTitle: 'Top 25 actions',
    type: 'bar-h',
    xKey: 'event_name_base',
    yKey: 'event_count',
    color: '#34d399',
    limit: 25,
    guide: 'This is taps / recordings, not people. One person can contribute many times. Use it to see what the app is logging, not how many customers you have.',
  },

  'mvp-dau': {
    id: 'mvp-dau',
    title: '1. Daily people who opened the app',
    subtitle: 'How many people opened the app or started a session each day',
    chartTitle: 'People who opened the app each day',
    type: 'line',
    xKey: 'event_date',
    yKey: 'dau',
    color: '#4f8cff',
    guide: 'This is app-open DAU. Other rates on this dashboard are “of people who opened the app” or “of people who scanned”. Notification display is tracked separately on Compare and is not mixed into this number.',
  },
  'mvp-time-to-first-scan': {
    id: 'mvp-time-to-first-scan',
    title: '2. New installs who scan the same day',
    subtitle: 'Of people who installed today, how many got a successful ID today',
    chartTitle: 'Share of new installs who scanned on day 1',
    type: 'line',
    xKey: 'event_date',
    yKey: 'day0_first_scan_rate',
    color: '#22d3ee',
    percent: true,
    guide: 'This is the “aha” moment. Installs = first-time open. Scanned on day 0 = they got a successful ID on that same day. Median time is how long that first success usually takes.',
    stats: [
      { key: 'cohort_users', label: 'New installs', format: 'number' },
      { key: 'users_scanned_day0', label: 'Got an ID the same day', format: 'number' },
      { key: 'day0_first_scan_rate', label: 'Same-day scan rate', format: 'percent' },
      { key: 'median_seconds_to_first_scan', label: 'Typical time to first ID', format: 'seconds' },
    ],
    extraCharts: [
      {
        title: 'New installs vs people who got an ID the same day',
        yKey: 'users_scanned_day0',
        color: '#22d3ee',
        type: 'bar',
      },
    ],
  },
  'mvp-identify-success': {
    id: 'mvp-identify-success',
    title: '3. Scan quality',
    subtitle: 'Of finished scans, what share came back as a success (not a failure)',
    chartTitle: 'Successful IDs vs failed IDs',
    type: 'line',
    xKey: 'event_date',
    yKey: 'identification_success_rate',
    color: '#34d399',
    percent: true,
    guide: 'This is about photo / AI quality, not how many people scanned. One person with 3 successes and 1 failure counts as 3 and 1. Higher is better.',
  },
  'mvp-quota-hit': {
    id: 'mvp-quota-hit',
    title: '4. Hit the free scan limit',
    subtitle: 'Of people who tried to scan, what share ran out of free scans',
    chartTitle: 'Share of scanners who hit the free limit',
    type: 'line',
    xKey: 'event_date',
    yKey: 'free_quota_hit_rate',
    color: '#fbbf24',
    percent: true,
    guide: 'Too high too early can mean frustrated users. Too low can mean little pressure to go Pro. This is only among people who actually tried to scan.',
  },
  'mvp-paywall': {
    id: 'mvp-paywall',
    title: '5. Paywall to purchase',
    subtitle: 'Of paywall views, how often someone confirms a purchase',
    chartTitle: 'Paywall views that turned into a purchase',
    type: 'line',
    xKey: 'event_date',
    yKey: 'paywall_to_confirm_rate',
    color: '#a78bfa',
    percent: true,
    guide: 'If many people see the paywall but few buy, check price, copy, or when we show it. This counts views and confirms, not unique people.',
  },
  'mvp-retention': {
    id: 'mvp-retention',
    title: '6. Do they come back?',
    subtitle: 'Of people who installed on a day, who opened the app again the next day and after a week',
    chartTitle: 'Came back the next day',
    type: 'line',
    xKey: 'cohort_date',
    yKey: 'd1_retention_rate',
    color: '#f87171',
    percent: true,
    guide: 'The first chart is “came back tomorrow”. The second is “came back after 7 days”. Empty recent days on the week chart are normal — those installs are not a week old yet.',
    extraCharts: [
      {
        title: 'Came back after 7 days',
        yKey: 'd7_retention_rate',
        color: '#fb923c',
        percent: true,
      },
    ],
  },
  'mvp-scans-per-user': {
    id: 'mvp-scans-per-user',
    title: '7. How many scans per person',
    subtitle: 'Successful IDs that day, divided by people who used the app that day',
    chartTitle: 'Successful IDs per person using the app',
    type: 'line',
    xKey: 'event_date',
    yKey: 'scans_per_dau',
    color: '#fb7185',
    guide: 'Rising people using the app plus falling scans per person usually means shallow opens: they open the app but do not Identify.',
  },
  'mvp-identify-funnel': {
    id: 'mvp-identify-funnel',
    title: '8. Started a scan → got a success',
    subtitle: 'Of people who opened Identify, what share got a successful ID that same day',
    chartTitle: 'People who opened Identify and got a success',
    type: 'line',
    xKey: 'event_date',
    yKey: 'open_to_success_rate',
    color: '#4f8cff',
    percent: true,
    guide: 'This is a simple same-day rate. For a step-by-step “where did they stop?” view, open Funnels → Identify.',
  },
  'mvp-catalogue': {
    id: 'mvp-catalogue',
    title: '9. Opened collection or catalogue',
    subtitle: 'Of people using the app, what share opened their collection or the global catalogue',
    chartTitle: 'Share of people who browsed collection or catalogue',
    type: 'line',
    xKey: 'event_date',
    yKey: 'catalogue_open_rate',
    color: '#34d399',
    percent: true,
    guide: 'This is habit beyond a single scan. For where they drop inside collection vs global catalogue, use the funnel tabs.',
  },
  'mvp-marketplace': {
    id: 'mvp-marketplace',
    title: '10. Used Marketplace',
    subtitle: 'Of people using the app, what share opened Marketplace or a listing',
    chartTitle: 'Share of people who used Marketplace',
    type: 'line',
    xKey: 'event_date',
    yKey: 'marketplace_engagement_rate',
    color: '#fbbf24',
    percent: true,
    guide: 'Commerce loop. For listing → contact seller, open Funnels → Marketplace. Feed is a separate tab.',
  },
};
