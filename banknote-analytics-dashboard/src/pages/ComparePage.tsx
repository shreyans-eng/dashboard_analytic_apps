import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { GitCompareArrows } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import ChartCard from '@/components/ChartCard';
import AppMark from '@/components/AppMark';
import { useTheme } from '@/lib/theme';
import { useDashboardMetric, useCompareLtv, useCompareSubscriptions } from '@/hooks/useAnalytics';
import { fmtNumber, fmtPercent, fmtUsd, fmtDecimal, QueryParams, defaultDateRange } from '@/lib/api';
import { useProduct } from '@/lib/product';

type SummaryRow = {
  product: string;
  dau: number | null;
  app_open_dau?: number | null;
  notification_dau?: number | null;
  any_event_dau?: number | null;
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
  app_open_dau?: number;
  notification_dau?: number;
  any_event_dau?: number;
  identification_success_rate: number;
  scans_per_dau: number;
  free_quota_hit_rate: number;
  paywall_to_confirm_rate: number;
  open_to_success_rate: number;
  catalogue_open_rate: number;
  marketplace_engagement_rate: number;
};

const COMPARE_METRICS: {
  key: string;
  label: string;
  format: 'number' | 'percent' | 'usd' | 'decimal';
  why: string;
  higherIsBetter: boolean;
  source?: 'signals' | 'ltv';
}[] = [
  { key: 'dau', label: 'Latest DAU (opened the app)', format: 'number', why: 'People who opened the app or started a session — not notification-only', higherIsBetter: true },
  { key: 'notification_dau', label: 'Notification DAU', format: 'number', why: 'People who received or displayed a push that day (not an app open)', higherIsBetter: true },
  { key: 'any_event_dau', label: 'Any Firebase event', format: 'number', why: 'Anyone with any event that day, including notifications', higherIsBetter: true },
  { key: 'installs', label: 'Installs (period)', format: 'number', why: 'Top of funnel', higherIsBetter: true },
  { key: 'identification_success_rate', label: 'Identify success', format: 'percent', why: 'AI + photo quality', higherIsBetter: true },
  { key: 'open_to_success_rate', label: 'Identify funnel', format: 'percent', why: 'Open → success conversion', higherIsBetter: true },
  { key: 'scans_per_user_day', label: 'Scans / user-day', format: 'decimal', why: 'Successful IDs ÷ people who opened the app that day', higherIsBetter: true },
  { key: 'free_quota_hit_rate', label: 'Quota hit rate', format: 'percent', why: 'Free-limit pressure (context-dependent)', higherIsBetter: false },
  { key: 'paywall_to_confirm_rate', label: 'Paywall → purchase', format: 'percent', why: 'Monetization conversion', higherIsBetter: true },
  { key: 'catalogue_open_rate', label: 'Catalogue engagement', format: 'percent', why: 'Browse / collection loop', higherIsBetter: true },
  { key: 'marketplace_engagement_rate', label: 'Marketplace engagement', format: 'percent', why: 'Commerce loop', higherIsBetter: true },
  { key: 'paying_users', label: 'Paying users', format: 'number', why: 'Pro conversions in range', higherIsBetter: true },
  { key: 'ltv_30', label: 'LTV-30', format: 'usd', why: 'USD in days 0–29 after install ÷ installs (mature cohorts)', higherIsBetter: true, source: 'ltv' },
  { key: 'ltv_90', label: 'LTV-90', format: 'usd', why: 'USD in days 0–89 after install ÷ installs', higherIsBetter: true, source: 'ltv' },
  { key: 'ltv_180', label: 'LTV-180', format: 'usd', why: 'USD in days 0–179 after install ÷ installs', higherIsBetter: true, source: 'ltv' },
];

type SubTierRow = {
  product: string;
  subscription_tier: string;
  purchases?: number;
  paying_users?: number;
  revenue_usd?: number;
};

const SUBSCRIPTION_TIERS = ['Monthly', 'Yearly', 'Lifetime'] as const;

type LtvCompareRow = {
  product: string;
  cohort_date: string;
  installs?: number;
  revenue_30?: number | null;
  revenue_90?: number | null;
  revenue_180?: number | null;
  ltv_30?: number | null;
  ltv_90?: number | null;
  ltv_180?: number | null;
};

function finiteNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Weighted cohort LTV from mature rows only (null revenue = immature). */
function rollupLtv(rows: LtvCompareRow[]) {
  let r30 = 0;
  let i30 = 0;
  let r90 = 0;
  let i90 = 0;
  let r180 = 0;
  let i180 = 0;
  let any = false;
  for (const r of rows) {
    any = true;
    const inst = Number(r.installs || 0);
    const a30 = finiteNum(r.revenue_30);
    const a90 = finiteNum(r.revenue_90);
    const a180 = finiteNum(r.revenue_180);
    // Prefer explicit revenue; fall back to ltv × installs when summary returns ltv only.
    const rev30 = a30 ?? (finiteNum(r.ltv_30) != null ? finiteNum(r.ltv_30)! * inst : null);
    const rev90 = a90 ?? (finiteNum(r.ltv_90) != null ? finiteNum(r.ltv_90)! * inst : null);
    const rev180 = a180 ?? (finiteNum(r.ltv_180) != null ? finiteNum(r.ltv_180)! * inst : null);
    if (rev30 != null) {
      r30 += rev30;
      i30 += inst;
    }
    if (rev90 != null) {
      r90 += rev90;
      i90 += inst;
    }
    if (rev180 != null) {
      r180 += rev180;
      i180 += inst;
    }
  }
  return {
    hasRows: any,
    ltv_30: i30 > 0 ? r30 / i30 : null,
    ltv_90: i90 > 0 ? r90 / i90 : null,
    ltv_180: i180 > 0 ? r180 / i180 : null,
  };
}

function pivotLtv(
  rows: LtvCompareRow[],
  window: 30 | 90 | 180,
  productLabels: string[],
) {
  const revKey = `revenue_${window}` as keyof LtvCompareRow;
  const ltvKey = `ltv_${window}` as keyof LtvCompareRow;
  const acc = new Map<string, Record<string, { rev: number; inst: number }>>();
  for (const r of rows) {
    const label = productLabels.find(
      (l) => String(l).toLowerCase() === String(r.product || '').toLowerCase(),
    );
    if (!label) continue;
    const inst = Number(r.installs || 0);
    const revDirect = finiteNum(r[revKey]);
    const ltv = finiteNum(r[ltvKey]);
    const rev = revDirect ?? (ltv != null ? ltv * inst : null);
    if (rev == null) continue;
    const date = String(r.cohort_date).slice(0, 10);
    const cur = acc.get(date) || {};
    const slot = cur[label] || { rev: 0, inst: 0 };
    slot.rev += rev;
    slot.inst += inst;
    cur[label] = slot;
    acc.set(date, cur);
  }
  return Array.from(acc.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, byProduct]) => {
      const row: Record<string, unknown> = { event_date: date };
      for (const l of productLabels) {
        const s = byProduct[l];
        row[l] = s && s.inst ? s.rev / s.inst : null;
      }
      return row;
    });
}

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
  // MVP signals can use a short range; LTV needs ≥180 days of install cohorts to fill LTV-180.
  const [params, setParams] = useState<QueryParams>(defaultDateRange(210));
  const [applied, setApplied] = useState(params);
  const { chart } = useTheme();
  const { products } = useProduct();

  const summaryQ = useDashboardMetric('compare-summary', applied);
  const dailyQ = useDashboardMetric('compare-daily', applied);

  // Always look back far enough for mature LTV windows (even if signal filters are shorter).
  const ltvParams = useMemo(() => {
    const base = defaultDateRange(210);
    const start = [applied.start_date, base.start_date].filter(Boolean).sort()[0];
    return {
      ...applied,
      start_date: start,
      end_date: applied.end_date || base.end_date,
      days: Math.max(Number(applied.days || 0), 210),
    };
  }, [applied]);
  const ltvQ = useCompareLtv(ltvParams);
  const subsQ = useCompareSubscriptions(applied);

  const summary = (summaryQ.data ?? []) as SummaryRow[];
  const daily = (dailyQ.data ?? []) as DailyRow[];
  const ltvRows = (ltvQ.data?.rows ?? []) as LtvCompareRow[];
  const ltvSummary = (ltvQ.data?.summary ?? []) as {
    product: string;
    ltv_30: number | null;
    ltv_90: number | null;
    ltv_180: number | null;
    installs?: number;
  }[];

  const labels = useMemo(
    () => products.map((p) => p.shortName),
    [products],
  );

  const colorByLabel = useMemo(() => {
    const map: Record<string, string> = {};
    products.forEach((p) => {
      map[p.shortName] = p.color;
    });
    return map;
  }, [products]);

  const matchProduct = (rowProduct: string, label: string) =>
    String(rowProduct || '').toLowerCase() === String(label || '').toLowerCase();

  const dauSeries = useMemo(() => pivotDaily(daily, 'dau', labels), [daily, labels]);
  const notificationDauSeries = useMemo(
    () => pivotDaily(daily, 'notification_dau', labels),
    [daily, labels],
  );
  const anyEventDauSeries = useMemo(
    () => pivotDaily(daily, 'any_event_dau', labels),
    [daily, labels],
  );
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
  const scansSeries = useMemo(
    () => pivotDaily(daily, 'scans_per_dau', labels),
    [daily, labels],
  );
  const paywallSeries = useMemo(
    () => pivotDaily(daily, 'paywall_to_confirm_rate', labels),
    [daily, labels],
  );
  const ltvByProduct = useMemo(() => {
    const map: Record<string, ReturnType<typeof rollupLtv>> = {};
    for (const l of labels) {
      const fromServer = ltvSummary.find((s) => matchProduct(s.product, l));
      if (fromServer) {
        map[l] = {
          hasRows: true,
          ltv_30: fromServer.ltv_30,
          ltv_90: fromServer.ltv_90,
          ltv_180: fromServer.ltv_180,
        };
      } else {
        map[l] = rollupLtv(ltvRows.filter((r) => matchProduct(r.product, l)));
      }
    }
    return map;
  }, [ltvRows, ltvSummary, labels]);
  const ltv30Series = useMemo(() => pivotLtv(ltvRows, 30, labels), [ltvRows, labels]);
  const ltv90Series = useMemo(() => pivotLtv(ltvRows, 90, labels), [ltvRows, labels]);
  const ltv180Series = useMemo(() => pivotLtv(ltvRows, 180, labels), [ltvRows, labels]);

  const subTierRows = (subsQ.data?.rows ?? []) as SubTierRow[];
  const subByProductTier = useMemo(() => {
    const map: Record<string, Record<string, SubTierRow>> = {};
    for (const row of subTierRows) {
      const product = String(row.product || '');
      if (!map[product]) map[product] = {};
      map[product][row.subscription_tier] = row;
    }
    return map;
  }, [subTierRows]);

  const tipStyle = {
    background: chart.tooltipBg,
    border: `1px solid ${chart.tooltipBorder}`,
    color: 'var(--text)',
  };

  const charts = [
    { title: 'Opened the app (DAU)', data: dauSeries, percent: false, usd: false, loading: dailyQ.isLoading, error: dailyQ.error?.message },
    { title: 'Notification (display / receive)', data: notificationDauSeries, percent: false, usd: false, loading: dailyQ.isLoading, error: dailyQ.error?.message },
    { title: 'Any Firebase event', data: anyEventDauSeries, percent: false, usd: false, loading: dailyQ.isLoading, error: dailyQ.error?.message },
    { title: 'Identify success', data: successSeries, percent: true, usd: false, loading: dailyQ.isLoading, error: dailyQ.error?.message },
    { title: 'Identify funnel (open → success)', data: funnelSeries, percent: true, usd: false, loading: dailyQ.isLoading, error: dailyQ.error?.message },
    { title: 'Scans / user-day', data: scansSeries, percent: false, usd: false, decimal: true, loading: dailyQ.isLoading, error: dailyQ.error?.message },
    { title: 'Paywall → purchase', data: paywallSeries, percent: true, usd: false, loading: dailyQ.isLoading, error: dailyQ.error?.message },
    { title: 'Catalogue engagement', data: catalogueSeries, percent: true, usd: false, loading: dailyQ.isLoading, error: dailyQ.error?.message },
    { title: 'Marketplace engagement', data: marketplaceSeries, percent: true, usd: false, loading: dailyQ.isLoading, error: dailyQ.error?.message },
    { title: 'LTV-30 (install cohorts)', data: ltv30Series, percent: false, usd: true, loading: ltvQ.isLoading, error: ltvQ.error?.message },
    { title: 'LTV-90 (install cohorts)', data: ltv90Series, percent: false, usd: true, loading: ltvQ.isLoading, error: ltvQ.error?.message },
    { title: 'LTV-180 (install cohorts)', data: ltv180Series, percent: false, usd: true, loading: ltvQ.isLoading, error: ltvQ.error?.message },
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
            Side-by-side on the same MVP signals plus cohort LTV for {labels.join(' · ')}.
            DAU is people who <strong>opened the app</strong> (<code>session_start</code> /{' '}
            <code>App_open</code> / <code>first_open</code>). Notification display is a separate
            series — it is not mixed into DAU. Default range is <strong>210 days</strong> so
            LTV-30 / 90 / 180 can fill. Immature cohorts stay empty until they age.
            For a written Combined / Banknote / Coinzy report, open{' '}
            <NavLink to="/report">Health report</NavLink>.
          </p>
        </div>
        <FilterBar
          params={params}
          onChange={setParams}
          onApply={(next) => setApplied({ ...(next ?? params) })}
          showPresets
        />
      </div>

      <div className="page-content">
        <div className="compare-head">
          {products.map((p) => (
            <div key={p.id} className="compare-brand" style={{ borderColor: p.color }}>
              <AppMark product={p.id} size={36} />
              <div>
                <strong style={{ color: p.color }}>{p.shortName}</strong>
                <span>{p.tagline}</span>
              </div>
            </div>
          ))}
        </div>

        {ltvQ.error && (
          <div className="empty-state error" style={{ marginBottom: 12 }}>
            Cohort LTV failed to load: {ltvQ.error.message}
          </div>
        )}
        {!ltvQ.isLoading && !ltvQ.error && ltvRows.length === 0 && (
          <div className="empty-state" style={{ marginBottom: 12 }}>
            No cohort LTV rows yet for this range. Widen the install-date range and Apply.
            Data is served from MongoDB (`cohort_ltv`) after the daily refresh.
          </div>
        )}
        {!ltvQ.isLoading && !ltvQ.error && ltvRows.length > 0 && (
          <p className="muted small" style={{ marginBottom: 12 }}>
            Cohort LTV: {ltvRows.length.toLocaleString()} rows
            {ltvQ.data?.source ? ` · source: ${ltvQ.data.source}` : ''}
            {Array.isArray(ltvQ.data?.sources) && ltvQ.data.sources.length
              ? ` (${ltvQ.data.sources.map((s) => `${s.product}=${s.source ?? 'unknown'}`).join(', ')})`
              : ''}
            {labels.some((l) => ltvByProduct[l]?.ltv_30 != null)
              ? ' · LTV-30 ready'
              : ' · widen date range if LTV cells are empty (need mature cohorts)'}
            . $0.00 means mature cohort with no IAP revenue yet.
          </p>
        )}

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
                  if (m.source === 'ltv') {
                    if (ltvQ.isLoading) return { label: l, value: NaN };
                    const raw = ltvByProduct[l]?.[m.key as 'ltv_30' | 'ltv_90' | 'ltv_180'];
                    return { label: l, value: raw == null ? NaN : Number(raw) };
                  }
                  const row = summary.find((r) => matchProduct(r.product, l));
                  return { label: l, value: Number(row?.[m.key as keyof SummaryRow] ?? NaN) };
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
                        {m.source === 'ltv' && ltvQ.isLoading
                          ? '…'
                          : !Number.isFinite(v.value)
                            ? '—'
                            : m.format === 'percent'
                              ? fmtPercent(v.value)
                              : m.format === 'usd'
                                ? fmtUsd(v.value)
                                : m.format === 'decimal'
                                  ? fmtDecimal(v.value)
                                  : fmtNumber(v.value)}
                      </td>
                    ))}
                    <td className={lead === 'tie' || lead === '—' ? 'muted' : ''}>
                      {m.source === 'ltv' && ltvQ.isLoading ? '…' : lead}
                    </td>
                    <td className="muted">{m.why}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 28 }}>
          <h3 style={{ marginBottom: 8 }}>Subscriptions by tier</h3>
          <p className="muted small" style={{ marginBottom: 12 }}>
            Monthly, Yearly, and Lifetime IAP purchases in the selected calendar range (all apps).
            Revenue uses Firebase <code>in_app_purchase</code> / <code>purchase</code> USD only,
            same rule as cohort LTV. Classified from <code>product_id</code> / <code>pack_name</code>.
          </p>
          {subsQ.error && (
            <div className="empty-state error" style={{ marginBottom: 12 }}>
              Subscription tiers failed: {subsQ.error.message}
            </div>
          )}
          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>Tier</th>
                  {labels.map((l) => (
                    <th key={`${l}-p`} colSpan={3} style={{ color: colorByLabel[l], textAlign: 'center' }}>
                      {l}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th />
                  {labels.flatMap((l) => [
                    <th key={`${l}-purchases`} className="muted">Purchases</th>,
                    <th key={`${l}-payers`} className="muted">Payers</th>,
                    <th key={`${l}-rev`} className="muted">Revenue</th>,
                  ])}
                </tr>
              </thead>
              <tbody>
                {SUBSCRIPTION_TIERS.map((tier) => (
                  <tr key={tier}>
                    <td><strong>{tier}</strong></td>
                    {labels.flatMap((l) => {
                      const row = subByProductTier[l]?.[tier]
                        ?? Object.entries(subByProductTier).find(([k]) => matchProduct(k, l))?.[1]?.[tier];
                      return [
                        <td key={`${l}-${tier}-p`}>
                          {subsQ.isLoading ? '…' : fmtNumber(Number(row?.purchases || 0))}
                        </td>,
                        <td key={`${l}-${tier}-u`}>
                          {subsQ.isLoading ? '…' : fmtNumber(Number(row?.paying_users || 0))}
                        </td>,
                        <td key={`${l}-${tier}-r`}>
                          {subsQ.isLoading ? '…' : fmtUsd(Number(row?.revenue_usd || 0))}
                        </td>,
                      ];
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!subsQ.isLoading && !subsQ.error && subTierRows.length === 0 && (
            <p className="muted small" style={{ marginTop: 8 }}>
              No classified subscription purchases in this range.
            </p>
          )}
        </div>

        <div className="chart-grid" style={{ marginTop: 24 }}>
          {charts.map((c) => (
            <ChartCard
              key={c.title}
              title={c.title}
              loading={c.loading}
              error={c.error}
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
                    tickFormatter={
                      c.percent
                        ? (v) => `${(Number(v) * 100).toFixed(0)}%`
                        : c.usd
                          ? (v) => `$${Number(v).toFixed(2)}`
                          : c.decimal
                            ? (v) => Number(v).toFixed(2)
                            : undefined
                    }
                  />
                  <Tooltip
                    formatter={
                      c.percent
                        ? (v: number) => fmtPercent(v)
                        : c.usd
                          ? (v: number) => fmtUsd(v)
                          : c.decimal
                            ? (v: number) => fmtDecimal(Number(v))
                            : undefined
                    }
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
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          ))}
        </div>

        <ul style={{ marginTop: 16, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
          <li>
            DAU = opened the app. Notification DAU = received/displayed a push.
            Any Firebase event includes both plus background analytics events.
          </li>
          <li>Same date range, country, and platform filters apply to all apps.</li>
          <li>Subscription tiers are calendar-period IAP counts, not cohort LTV.</li>
          <li>Funnel / catalogue / marketplace need matching Firebase events or rates stay near zero.</li>
          <li>Add another app via <code>PRODUCTS=...</code> in <code>.env</code> — see <code>docs/PROJECT.md</code>.</li>
        </ul>
      </div>
    </>
  );
}
