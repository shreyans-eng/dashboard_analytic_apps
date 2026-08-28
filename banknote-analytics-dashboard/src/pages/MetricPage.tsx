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

export interface ExtraChartLine {
  yKey: string;
  name: string;
  color: string;
  strokeWidth?: number;
}

export interface ExtraChart {
  title: string;
  yKey: string;
  color: string;
  percent?: boolean;
  type?: 'line' | 'bar' | 'multi';
  lines?: ExtraChartLine[];
}

export interface MetricStat {
  key: string;
  label: string;
  format?: 'number' | 'percent' | 'seconds' | 'avg';
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

function fmtScanCell(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  if (n >= 100) return fmtNumber(n);
  return n.toFixed(1);
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
  if (stat.format === 'avg') {
    const vals = rows.map((r) => Number(r[stat.key])).filter((n) => Number.isFinite(n));
    if (!vals.length) return '—';
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (avg >= 100) return fmtNumber(avg);
    return avg.toFixed(1);
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
  const isCoinzyIdentifyFunnel = config.id === 'mvp-identify-funnel' && product.id === 'coinzy';
  const title = isCoinzyIdentifyFunnel ? '8. Camera → got a success' : config.title;
  const subtitle = isCoinzyIdentifyFunnel
    ? 'Of people who opened the Identify camera, what share got a successful ID that same day'
    : config.subtitle;
  const chartTitle = isCoinzyIdentifyFunnel
    ? 'People who opened the camera and got a success'
    : config.chartTitle;
  const guide = isCoinzyIdentifyFunnel
    ? 'Coinzy denominator is camera (Identification_screen ∪ photo_screen), not Identify_bottom_nav ∪ Identify_home — nav also fires when camera opens from Home. Success is identification_done_success ∪ Identification_done. Tab 3 is quality only. The path Camera → Photos → Submit → Success → Details is Funnels → Identify. Add-to-collection cannot be measured (no live success event).'
    : config.guide;

  return (
    <>
      <div className="page-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle} · {product.shortName}</p>
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
        {guide && (
          <div className="page-hint" style={{ marginBottom: 16 }}>
            {guide}
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
            title={chartTitle}
            loading={query.isLoading}
            error={query.error?.message}
          >
            {emptyCompleteRange ? (
              <div className="empty-data">
                {isDau && incomplete && latestComplete && (!params.start_date || params.start_date > latestComplete)
                  ? 'Data unavailable — this range is after the latest complete Firebase daily export.'
                  : 'No matching data in this range.'}
              </div>
            ) : (
            <ResponsiveContainer width="100%" height={420}>
              {config.type === 'pie' ? (
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
              ) : config.type === 'bar-h' ? (
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
              ) : config.type === 'bar' ? (
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
              ) : (
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
              ) : extra.lines ? (
                <ResponsiveContainer width="100%" height={420}>
                  <LineChart data={rows}>
                    <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" />
                    <XAxis
                      dataKey={config.xKey}
                      tick={{ fill: chart.tick, fontSize: 11 }}
                      tickFormatter={(v) => formatXTick(v, config.xKey)}
                    />
                    <YAxis tick={{ fill: chart.tick, fontSize: 11 }} />
                    <Tooltip
                      contentStyle={tipStyle}
                      formatter={(v: number, name: string) => [
                        Number.isFinite(Number(v)) ? Number(v).toFixed(1) : '—',
                        name,
                      ]}
                    />
                    <Legend />
                    {extra.lines.map((line) => (
                      <Line
                        key={line.yKey}
                        type="monotone"
                        dataKey={line.yKey}
                        name={line.name}
                        stroke={line.color}
                        strokeWidth={line.strokeWidth ?? 2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
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
        {config.id === 'mvp-scans-per-user' && rows.length > 0 && (
          <div className="results-table-wrap" style={{ marginTop: 8 }}>
            <table className="results-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Avg / person</th>
                  <th>Avg / scanner</th>
                  <th>P10</th>
                  <th>P25</th>
                  <th>P50</th>
                  <th>P75</th>
                  <th>P90</th>
                  <th>P95</th>
                  <th>P99</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r.event_date)}>
                    <td>{String(r.event_date ?? '').slice(0, 10)}</td>
                    <td>{fmtScanCell(r.scans_per_dau)}</td>
                    <td>{fmtScanCell(r.scans_per_scanning_user)}</td>
                    <td>{fmtScanCell(r.scans_p10)}</td>
                    <td>{fmtScanCell(r.scans_p25)}</td>
                    <td>{fmtScanCell(r.scans_p50)}</td>
                    <td>{fmtScanCell(r.scans_p75)}</td>
                    <td>{fmtScanCell(r.scans_p90)}</td>
                    <td>{fmtScanCell(r.scans_p95)}</td>
                    <td>{fmtScanCell(r.scans_p99)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
    guide: 'Installs = devices (`user_pseudo_id`) with first_open that calendar day. Same-day ID = those devices that also fired identification_done_success that day. Join is device id only — empty or post-login user_id is ignored.',
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
    guide: 'Too high too early can mean frustrated users. Too low can mean little pressure to go Pro. This tab mixes several limit events. For the Coinzy free-scan experiment (success remaining → 0), open Explorer → Free-scan success quota — that uses only free_scan_success_quota_exhausted.',
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
    guide: 'Counts views and confirms (not unique people). Standard and discount screens are included. For unique people, pack mix, Google Play sheet, and onboarding → subscription, open Funnels → Paywall and Funnels → Onboarding → subs.',
  },
  'mvp-retention': {
    id: 'mvp-retention',
    title: '6. Do they come back?',
    subtitle: 'Of people who installed on a day, who opened the app again — D1, D4, D7, and anytime in D4–D7',
    chartTitle: 'Came back the next day (D1)',
    type: 'line',
    xKey: 'cohort_date',
    yKey: 'd1_retention_rate',
    color: '#f87171',
    percent: true,
    guide: 'D1, D4, and D7 are different days (not the same chart). D4–D7 is anyone who came back on at least one of days 4, 5, 6, or 7. Empty recent days are normal — those installs are not old enough yet.',
    extraCharts: [
      {
        title: 'Came back on day 4 (D4)',
        yKey: 'd4_retention_rate',
        color: '#fb923c',
        percent: true,
      },
      {
        title: 'Came back after 7 days (D7)',
        yKey: 'd7_retention_rate',
        color: '#fbbf24',
        percent: true,
      },
      {
        title: 'Came back anytime in D4–D7',
        yKey: 'd4_d7_retention_rate',
        color: '#34d399',
        percent: true,
      },
    ],
  },
  'mvp-scans-per-user': {
    id: 'mvp-scans-per-user',
    title: '7. How many scans per person',
    subtitle: 'Successful IDs that day, divided by people who used the app that day',
    chartTitle: 'Successful IDs per person using the app (average)',
    type: 'line',
    xKey: 'event_date',
    yKey: 'scans_per_dau',
    color: '#fb7185',
    guide: 'The average includes people who opened the app and did not Identify. Percentiles (P10, P25, P50, P75, P90, P95, P99) are only among people who got at least one successful ID that day, so a few heavy scanners cannot hide what a typical scanner does.',
    stats: [
      { key: 'scans_per_dau', label: 'Average / person', format: 'avg' },
      { key: 'scans_per_scanning_user', label: 'Average / scanner', format: 'avg' },
      { key: 'scans_p10', label: 'P10', format: 'avg' },
      { key: 'scans_p25', label: 'P25', format: 'avg' },
      { key: 'scans_p50', label: 'P50', format: 'avg' },
      { key: 'scans_p75', label: 'P75', format: 'avg' },
      { key: 'scans_p90', label: 'P90', format: 'avg' },
      { key: 'scans_p95', label: 'P95', format: 'avg' },
      { key: 'scans_p99', label: 'P99', format: 'avg' },
    ],
    extraCharts: [
      {
        title: 'Successful IDs per scanning person (P10, P25, P50, P75, P90, P95, P99)',
        yKey: 'scans_p50',
        color: '#4f8cff',
        type: 'multi',
        lines: [
          { yKey: 'scans_p10', name: 'P10', color: '#94a3b8' },
          { yKey: 'scans_p25', name: 'P25', color: '#67e8f9' },
          { yKey: 'scans_p50', name: 'P50 (typical)', color: '#4f8cff', strokeWidth: 2.5 },
          { yKey: 'scans_p75', name: 'P75', color: '#34d399' },
          { yKey: 'scans_p90', name: 'P90', color: '#fb923c' },
          { yKey: 'scans_p95', name: 'P95', color: '#fbbf24' },
          { yKey: 'scans_p99', name: 'P99', color: '#f87171' },
        ],
      },
    ],
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
    guide: 'This KPI is a simple same-day rate. Tab 3 is quality only (success ÷ success+failure). The full path — permission, photo 1, photo 2, submit, top 5 results, details, add to collection — is Funnels → Identify.',
  },
  'mvp-catalogue': {
    id: 'mvp-catalogue',
    title: '9. Collection vs global catalogue',
    subtitle: 'Private collection and global catalogue are counted separately — they are not mixed',
    chartTitle: 'Share who opened private collection',
    type: 'line',
    xKey: 'event_date',
    yKey: 'private_collection_open_rate',
    color: '#34d399',
    percent: true,
    guide: 'Private collection = Collection_screen / collection nav. Global catalogue is the second chart. For step drop-off, use Funnels → Private collection or Global catalogue — not Catalogue (all).',
    extraCharts: [
      {
        title: 'Share who opened global catalogue',
        yKey: 'global_catalogue_open_rate',
        color: '#4f8cff',
        percent: true,
      },
    ],
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
