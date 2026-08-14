import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { GitCompareArrows } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import ChartCard from '@/components/ChartCard';
import { useTheme } from '@/lib/theme';
import { useDashboardMetric } from '@/hooks/useAnalytics';
import { fmtNumber, fmtPercent, QueryParams, defaultDateRange } from '@/lib/api';
import { useProduct } from '@/lib/product';

type SummaryRow = {
  product: string;
  dau: number;
  unique_users: number;
  installs: number;
  success_scans: number;
  identification_success_rate: number;
  scans_per_user_day: number;
  free_quota_hit_rate: number;
  paywall_to_confirm_rate: number;
  open_to_success_rate: number;
  catalogue_open_rate: number;
  marketplace_engagement_rate: number;
  paying_users: number;
};

type DailyRow = {
  event_date: string;
  product: string;
  dau: number;
  identification_success_rate: number;
  scans_per_dau: number;
  free_quota_hit_rate: number;
  paywall_to_confirm_rate: number;
  open_to_success_rate: number;
  catalogue_open_rate: number;
  marketplace_engagement_rate: number;
};

const COMPARE_METRICS: {
  key: keyof SummaryRow;
  label: string;
  format: 'number' | 'percent';
  why: string;
  higherIsBetter: boolean;
}[] = [
  { key: 'dau', label: 'Latest DAU', format: 'number', why: 'Baseline active users', higherIsBetter: true },
  { key: 'installs', label: 'Installs (period)', format: 'number', why: 'Top of funnel', higherIsBetter: true },
  { key: 'identification_success_rate', label: 'Identify success', format: 'percent', why: 'AI + photo quality', higherIsBetter: true },
  { key: 'open_to_success_rate', label: 'Identify funnel', format: 'percent', why: 'Open → success conversion', higherIsBetter: true },
  { key: 'scans_per_user_day', label: 'Scans / user-day', format: 'number', why: 'Engagement depth', higherIsBetter: true },
  { key: 'free_quota_hit_rate', label: 'Quota hit rate', format: 'percent', why: 'Free-limit pressure (context-dependent)', higherIsBetter: false },
  { key: 'paywall_to_confirm_rate', label: 'Paywall → purchase', format: 'percent', why: 'Monetization conversion', higherIsBetter: true },
  { key: 'catalogue_open_rate', label: 'Catalogue engagement', format: 'percent', why: 'Browse / collection loop', higherIsBetter: true },
  { key: 'marketplace_engagement_rate', label: 'Marketplace engagement', format: 'percent', why: 'Commerce loop', higherIsBetter: true },
  { key: 'paying_users', label: 'Paying users', format: 'number', why: 'Pro conversions in range', higherIsBetter: true },
];

function pivotDaily(
  rows: DailyRow[],
  metric: keyof DailyRow,
  productLabels: string[],
) {
  const byDate = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    const date = String(r.event_date).slice(0, 10);
    const cur = byDate.get(date) || { event_date: date };
    if (productLabels.includes(r.product)) {
      cur[r.product] = Number(r[metric] ?? 0);
    }
    byDate.set(date, cur);
  }
  return Array.from(byDate.values()).sort((a, b) =>
    String(a.event_date).localeCompare(String(b.event_date)),
  );
}

function winnerAmong(
  values: { label: string; value: number }[],
  higherIsBetter: boolean,
): string {
  const finite = values.filter((v) => Number.isFinite(v.value));
  if (finite.length < 2) return '—';
  finite.sort((a, b) => (higherIsBetter ? b.value - a.value : a.value - b.value));
  if (Math.abs(finite[0].value - finite[1].value) < 1e-9) return 'tie';
  return finite[0].label;
}

export default function ComparePage() {
  const [params, setParams] = useState<QueryParams>(defaultDateRange(30));
  const [applied, setApplied] = useState(params);
  const { chart } = useTheme();
  const { products } = useProduct();

  const summaryQ = useDashboardMetric('compare-summary', applied);
  const dailyQ = useDashboardMetric('compare-daily', applied);

  const summary = (summaryQ.data ?? []) as SummaryRow[];
  const daily = (dailyQ.data ?? []) as DailyRow[];

  const labels = useMemo(
    () => products.map((p) => p.shortName),
    [products],
  );

  const colorByLabel = useMemo(() => {
    const map: Record<string, string> = {};
    products.forEach((p) => {
      map[p.shortName] = p.color || '#4f8cff';
    });
    return map;
  }, [products]);

  const dauSeries = useMemo(() => pivotDaily(daily, 'dau', labels), [daily, labels]);
  const successSeries = useMemo(
    () => pivotDaily(daily, 'identification_success_rate', labels),
    [daily, labels],
  );
  const funnelSeries = useMemo(
    () => pivotDaily(daily, 'open_to_success_rate', labels),
    [daily, labels],
  );
  const catalogueSeries = useMemo(
    () => pivotDaily(daily, 'catalogue_open_rate', labels),
    [daily, labels],
  );
  const marketplaceSeries = useMemo(
    () => pivotDaily(daily, 'marketplace_engagement_rate', labels),
    [daily, labels],
  );
  const paywallSeries = useMemo(
    () => pivotDaily(daily, 'paywall_to_confirm_rate', labels),
    [daily, labels],
  );

  const tipStyle = {
    background: chart.tooltipBg,
    border: `1px solid ${chart.tooltipBorder}`,
    color: 'var(--text)',
  };

  const charts = [
    { title: 'DAU', data: dauSeries, percent: false },
    { title: 'Identify success', data: successSeries, percent: true },
    { title: 'Identify funnel (open → success)', data: funnelSeries, percent: true },
    { title: 'Paywall → purchase', data: paywallSeries, percent: true },
    { title: 'Catalogue engagement', data: catalogueSeries, percent: true },
    { title: 'Marketplace engagement', data: marketplaceSeries, percent: true },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GitCompareArrows size={22} />
            Compare Apps
          </h2>
          <p>
            Side-by-side on the same MVP signals for {labels.join(' · ')}. Switch to a single app
            in the sidebar to drill into that product alone.
          </p>
        </div>
        <FilterBar
          params={params}
          onChange={setParams}
          onApply={() => setApplied({ ...params })}
        />
      </div>

      <div className="page-content">
        <div className="compare-head">
          {products.map((p) => (
            <div key={p.id} className="compare-brand" style={{ borderColor: p.color || '#4f8cff' }}>
              <strong style={{ color: p.color }}>{p.shortName}</strong>
              <span>{p.tagline}</span>
            </div>
          ))}
        </div>

        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Metric</th>
                {labels.map((l) => (
                  <th key={l} style={{ color: colorByLabel[l] }}>{l}</th>
                ))}
                <th>Leader</th>
                <th>Why it matters</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_METRICS.map((m) => {
                const vals = labels.map((l) => {
                  const row = summary.find((r) => r.product === l);
                  return { label: l, value: Number(row?.[m.key] ?? NaN) };
                });
                const lead = winnerAmong(vals, m.higherIsBetter);
                return (
                  <tr key={m.key}>
                    <td>{m.label}</td>
                    {vals.map((v) => (
                      <td
                        key={v.label}
                        className={lead === v.label ? 'win' : Number.isFinite(v.value) ? '' : 'muted'}
                      >
                        {!Number.isFinite(v.value)
                          ? '—'
                          : m.format === 'percent'
                            ? fmtPercent(v.value)
                            : fmtNumber(v.value)}
                      </td>
                    ))}
                    <td className={lead === 'tie' || lead === '—' ? 'muted' : ''}>{lead}</td>
                    <td className="muted">{m.why}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="chart-grid" style={{ marginTop: 24 }}>
          {charts.map((c) => (
            <ChartCard
              key={c.title}
              title={c.title}
              loading={dailyQ.isLoading}
              error={dailyQ.error?.message}
            >
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={c.data}>
                  <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="event_date"
                    tick={{ fill: chart.tick, fontSize: 11 }}
                    tickFormatter={(v) => String(v).slice(5)}
                  />
                  <YAxis
                    tick={{ fill: chart.tick, fontSize: 11 }}
                    tickFormatter={c.percent ? (v) => `${(Number(v) * 100).toFixed(0)}%` : undefined}
                  />
                  <Tooltip
                    formatter={c.percent ? (v: number) => fmtPercent(v) : undefined}
                    contentStyle={tipStyle}
                  />
                  <Legend />
                  {labels.map((l) => (
                    <Line
                      key={l}
                      type="monotone"
                      dataKey={l}
                      stroke={colorByLabel[l]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          ))}
        </div>

        <ul style={{ marginTop: 16, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
          <li>Same date range, country, and platform filters apply to all apps.</li>
          <li>Funnel / catalogue / marketplace need matching Firebase events or rates stay near zero.</li>
          <li>Add another app via <code>PRODUCTS=...</code> in <code>.env</code> — see docs.</li>
        </ul>
      </div>
    </>
  );
}
