import { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { ChevronLeft, ChevronRight, CircleDollarSign } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import ChartCard from '@/components/ChartCard';
import { useTheme } from '@/lib/theme';
import { useLtv } from '@/hooks/useAnalytics';
import { fmtNumber, fmtPercent, fmtUsd, QueryParams } from '@/lib/api';
import { useProduct } from '@/lib/product';

type LtvRow = {
  cohort_date: string;
  country?: string;
  install_channel?: string;
  installs?: number;
  revenue_30?: number | null;
  revenue_90?: number | null;
  revenue_180?: number | null;
  ltv_30?: number | null;
  ltv_90?: number | null;
  ltv_180?: number | null;
  payers_30?: number | null;
  payers_90?: number | null;
  payers_180?: number | null;
  paid_rate_30?: number | null;
  paid_rate_90?: number | null;
  paid_rate_180?: number | null;
};

const CHANNELS = ['Organic', 'Paid', 'Direct'] as const;
const CHANNEL_COLOR: Record<string, string> = {
  Organic: '#34d399',
  Paid: '#fbbf24',
  Direct: '#4f8cff',
};
const PAGE_SIZES = [25, 50, 100];

const CHANNEL_HELP: { id: typeof CHANNELS[number]; title: string; points: string[] }[] = [
  {
    id: 'Organic',
    title: 'Organic',
    points: [
      'User found the app without an ad: Play Store / App Store listing or organic search.',
      'Typical first_open source: google-play or google with medium organic.',
    ],
  },
  {
    id: 'Paid',
    title: 'Paid',
    points: [
      'Install attributed to advertising (Google Ads CPC, other paid media, or a gclid).',
      'Typical first_open source: google with medium cpc.',
    ],
  },
  {
    id: 'Direct',
    title: 'Direct',
    points: [
      'Opened with no campaign — Firebase reports (direct) / (none).',
      'Not “empty UTM”: channel is taken from first_open traffic_source, then frozen.',
    ],
  },
];

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function finite(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

interface Props {
  params: QueryParams;
  setParams: (p: QueryParams) => void;
  applyFilters: () => void;
}

export default function LtvPage({ params, setParams, applyFilters }: Props) {
  const { product, isCompare } = useProduct();
  const { chart } = useTheme();
  const [tableQuery, setTableQuery] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const ltvParams = useMemo(
    () => ({
      ...params,
      page,
      page_size: pageSize,
      search: tableQuery.trim() || undefined,
      paginate: true,
    }),
    [params, page, pageSize, tableQuery],
  );

  const q = useLtv(ltvParams, !isCompare);
  const rows = (q.data?.rows ?? []) as LtvRow[];
  const dataSource = q.data?.source;
  const total = Number(q.data?.total ?? rows.length);
  const pageCount = Math.max(
    1,
    Number(q.data?.page_count ?? (Math.ceil(total / pageSize) || 1)),
  );
  const safePage = Math.min(page, pageCount - 1);

  const tipStyle = useMemo(
    () => ({
      background: chart.tooltipBg,
      border: `1px solid ${chart.tooltipBorder}`,
      color: 'var(--text)',
    }),
    [chart],
  );

  const daily = useMemo(() => {
    if (Array.isArray(q.data?.daily) && q.data.daily.length) {
      return q.data.daily as {
        event_date: string;
        installs: number;
        ltv_30: number | null;
        ltv_90: number | null;
        ltv_180: number | null;
      }[];
    }
    const byDate = new Map<string, {
      event_date: string;
      installs: number;
      rev30: number;
      rev90: number;
      rev180: number;
      inst30: number;
      inst90: number;
      inst180: number;
    }>();
    for (const r of rows) {
      const date = String(r.cohort_date).slice(0, 10);
      const cur = byDate.get(date) || {
        event_date: date,
        installs: 0,
        rev30: 0,
        rev90: 0,
        rev180: 0,
        inst30: 0,
        inst90: 0,
        inst180: 0,
      };
      cur.installs += num(r.installs);
      const r30 = finite(r.revenue_30);
      const r90 = finite(r.revenue_90);
      const r180 = finite(r.revenue_180);
      if (r30 != null) {
        cur.rev30 += r30;
        cur.inst30 += num(r.installs);
      }
      if (r90 != null) {
        cur.rev90 += r90;
        cur.inst90 += num(r.installs);
      }
      if (r180 != null) {
        cur.rev180 += r180;
        cur.inst180 += num(r.installs);
      }
      byDate.set(date, cur);
    }
    return Array.from(byDate.values())
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .map((d) => ({
        event_date: d.event_date,
        installs: d.installs,
        ltv_30: d.inst30 ? d.rev30 / d.inst30 : null,
        ltv_90: d.inst90 ? d.rev90 / d.inst90 : null,
        ltv_180: d.inst180 ? d.rev180 / d.inst180 : null,
      }));
  }, [q.data?.daily, rows]);

  const byChannel = useMemo(() => {
    if (Array.isArray(q.data?.by_channel) && q.data.by_channel.length) {
      return CHANNELS.map((ch) => {
        const row = (q.data!.by_channel as { channel: string; installs: number; ltv_30: number | null; ltv_90: number | null; ltv_180: number | null }[])
          .find((c) => c.channel === ch);
        return row || { channel: ch, installs: 0, ltv_30: null, ltv_90: null, ltv_180: null };
      });
    }
    const acc: Record<string, { channel: string; installs: number; rev30: number; rev90: number; rev180: number; inst30: number; inst90: number; inst180: number }> = {};
    for (const ch of CHANNELS) {
      acc[ch] = { channel: ch, installs: 0, rev30: 0, rev90: 0, rev180: 0, inst30: 0, inst90: 0, inst180: 0 };
    }
    for (const r of rows) {
      const ch = String(r.install_channel || '');
      if (!acc[ch]) continue;
      acc[ch].installs += num(r.installs);
      const r30 = finite(r.revenue_30);
      const r90 = finite(r.revenue_90);
      const r180 = finite(r.revenue_180);
      if (r30 != null) {
        acc[ch].rev30 += r30;
        acc[ch].inst30 += num(r.installs);
      }
      if (r90 != null) {
        acc[ch].rev90 += r90;
        acc[ch].inst90 += num(r.installs);
      }
      if (r180 != null) {
        acc[ch].rev180 += r180;
        acc[ch].inst180 += num(r.installs);
      }
    }
    return CHANNELS.map((ch) => ({
      channel: ch,
      installs: acc[ch].installs,
      ltv_30: acc[ch].inst30 ? acc[ch].rev30 / acc[ch].inst30 : null,
      ltv_90: acc[ch].inst90 ? acc[ch].rev90 / acc[ch].inst90 : null,
      ltv_180: acc[ch].inst180 ? acc[ch].rev180 / acc[ch].inst180 : null,
    }));
  }, [q.data?.by_channel, rows]);

  const totals = useMemo(() => {
    if (q.data?.totals && typeof q.data.totals === 'object') {
      const t = q.data.totals as {
        installs?: number;
        ltv_30?: number | null;
        ltv_90?: number | null;
        ltv_180?: number | null;
      };
      return {
        installs: num(t.installs),
        ltv_30: finite(t.ltv_30),
        ltv_90: finite(t.ltv_90),
        ltv_180: finite(t.ltv_180),
      };
    }
    let installs = 0;
    let rev30 = 0;
    let rev90 = 0;
    let rev180 = 0;
    let inst30 = 0;
    let inst90 = 0;
    let inst180 = 0;
    for (const r of rows) {
      installs += num(r.installs);
      const r30 = finite(r.revenue_30);
      const r90 = finite(r.revenue_90);
      const r180 = finite(r.revenue_180);
      if (r30 != null) {
        rev30 += r30;
        inst30 += num(r.installs);
      }
      if (r90 != null) {
        rev90 += r90;
        inst90 += num(r.installs);
      }
      if (r180 != null) {
        rev180 += r180;
        inst180 += num(r.installs);
      }
    }
    return {
      installs,
      ltv_30: inst30 ? rev30 / inst30 : null,
      ltv_90: inst90 ? rev90 / inst90 : null,
      ltv_180: inst180 ? rev180 / inst180 : null,
    };
  }, [q.data?.totals, rows]);

  useEffect(() => {
    setPage(0);
  }, [tableQuery, pageSize, params.start_date, params.end_date, params.country, params.platform, params.install_channel]);

  const from = total === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min(total, safePage * pageSize + rows.length);

  const setChannel = (channel: string | undefined) => {
    setParams({ ...params, install_channel: channel });
    applyFilters();
  };

  const extraCountries = Array.isArray(q.data?.countries) && q.data.countries.length
    ? q.data.countries.map(String)
    : Array.from(new Set(rows.map((r) => String(r.country || 'Unknown').trim()).filter(Boolean)));

  return (
    <>
      <div className="page-header ltv-page-header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CircleDollarSign size={22} />
            Cohort LTV
          </h2>
          <p>
            Revenue in the N days after install ÷ installs · {product.shortName}. Date range is{' '}
            <strong>install (cohort) dates</strong>, not purchase dates. Include dates at least 30 / 90 / 180
            days ago for LTV-30 / 90 / 180; newer cohorts stay empty until they mature.
            {dataSource ? ` · source: ${dataSource}` : ''}
          </p>
        </div>
        <FilterBar
          params={params}
          onChange={setParams}
          onApply={applyFilters}
          showChannel
          showPresets
          extraCountries={extraCountries}
        />
      </div>

      <div className="page-content">
        {isCompare && (
          <div className="empty-state">
            Select <strong>Banknote</strong> or <strong>Coinzy</strong> (not Compare) to inspect cohort LTV.
          </div>
        )}

        {!isCompare && (
          <>
            {q.error && (
              <div className="empty-state error" style={{ marginBottom: 12 }}>
                {q.error.message}
              </div>
            )}
            <div className="ltv-channel-help">
              <h3>What Organic, Paid, and Direct mean</h3>
              <p>
                Every install is classified once, from the user’s <strong>first open</strong>. Later purchases
                or sessions do not change the channel. Click a card to filter the page.
              </p>
              <div className="ltv-channel-grid">
                {CHANNEL_HELP.map((ch) => {
                  const stats = byChannel.find((c) => c.channel === ch.id);
                  const installs = stats?.installs ?? 0;
                  const share = totals.installs ? installs / totals.installs : 0;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      className={`ltv-channel-card ${params.install_channel === ch.id ? 'on' : ''}`}
                      onClick={() => setChannel(params.install_channel === ch.id ? undefined : ch.id)}
                    >
                      <strong style={{ color: CHANNEL_COLOR[ch.id] }}>{ch.title}</strong>
                      <span className="ltv-channel-stat">
                        {fmtNumber(installs)}
                        <small>
                          installs{totals.installs ? ` · ${fmtPercent(share)}` : ''}
                        </small>
                      </span>
                      <ul>
                        {ch.points.map((pt) => (
                          <li key={pt}>{pt}</li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
              {params.install_channel && (
                <button type="button" className="ltv-channel-clear" onClick={() => setChannel(undefined)}>
                  Show all channels
                </button>
              )}
            </div>

            <div className="funnel-kpis">
              <div className="funnel-kpi">
                <span className="funnel-kpi-label">Installs in range</span>
                <span className="funnel-kpi-value">{fmtNumber(totals.installs)}</span>
              </div>
              {byChannel.map((ch) => (
                <div className="funnel-kpi" key={ch.channel}>
                  <span className="funnel-kpi-label" style={{ color: CHANNEL_COLOR[ch.channel] }}>
                    {ch.channel} installs
                  </span>
                  <span className="funnel-kpi-value">{fmtNumber(ch.installs)}</span>
                  <span className="muted small">
                    {totals.installs ? fmtPercent(ch.installs / totals.installs) : '—'} of total
                  </span>
                </div>
              ))}
            </div>
            <div className="funnel-kpis">
              <div className="funnel-kpi">
                <span className="funnel-kpi-label">LTV-30</span>
                <span className="funnel-kpi-value">{fmtUsd(totals.ltv_30)}</span>
              </div>
              <div className="funnel-kpi">
                <span className="funnel-kpi-label">LTV-90</span>
                <span className="funnel-kpi-value">{fmtUsd(totals.ltv_90)}</span>
              </div>
              <div className="funnel-kpi">
                <span className="funnel-kpi-label">LTV-180</span>
                <span className="funnel-kpi-value">{fmtUsd(totals.ltv_180)}</span>
              </div>
            </div>

            <div className="chart-grid">
              <ChartCard
                title="LTV-30 / 90 / 180 by install date"
                loading={q.isLoading}
                error={q.error?.message}
              >
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={daily}>
                    <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="event_date"
                      tick={{ fill: chart.tick, fontSize: 11 }}
                      tickFormatter={(v) => String(v).slice(5)}
                    />
                    <YAxis
                      tick={{ fill: chart.tick, fontSize: 11 }}
                      tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
                    />
                    <Tooltip
                      formatter={(v: number) => fmtUsd(v)}
                      contentStyle={tipStyle}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="ltv_30" name="LTV-30" stroke="#4f8cff" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="ltv_90" name="LTV-90" stroke="#34d399" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="ltv_180" name="LTV-180" stroke="#fbbf24" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="LTV by acquisition channel" loading={q.isLoading} error={q.error?.message}>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={byChannel}>
                    <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="channel"
                      tick={{ fill: chart.tick, fontSize: 11 }}
                      tickFormatter={(v) => {
                        const row = byChannel.find((c) => c.channel === v);
                        return `${v} (${fmtNumber(row?.installs ?? 0)})`;
                      }}
                    />
                    <YAxis
                      tick={{ fill: chart.tick, fontSize: 11 }}
                      tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
                    />
                    <Tooltip
                      formatter={(v: number, name: string) =>
                        name === 'Installs' ? fmtNumber(v) : fmtUsd(v)
                      }
                      labelFormatter={(label) => {
                        const row = byChannel.find((c) => c.channel === label);
                        return `${label} · ${fmtNumber(row?.installs ?? 0)} installs`;
                      }}
                      contentStyle={tipStyle}
                    />
                    <Legend />
                    <Bar dataKey="ltv_30" name="LTV-30" fill="#4f8cff" />
                    <Bar dataKey="ltv_90" name="LTV-90" fill="#34d399" />
                    <Bar dataKey="ltv_180" name="LTV-180" fill="#fbbf24" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <ChartCard title="Cohort × country × channel">
              <p className="funnel-note" style={{ marginTop: 0 }}>
                Channel and country are frozen at <code>first_open</code>. Revenue is{' '}
                <code>in_app_purchase</code> / <code>purchase</code> USD (not Subs_confirm counts).
                Empty LTV cells = cohort not yet mature.
              </p>
              <div className="ltv-table-toolbar">
                <input
                  type="search"
                  placeholder="Filter table by country, channel, or date…"
                  value={tableQuery}
                  onChange={(e) => setTableQuery(e.target.value)}
                  aria-label="Filter table"
                />
                <span className="muted small">
                  {q.isLoading
                    ? 'Loading…'
                    : `${fmtNumber(from)}–${fmtNumber(to)} of ${fmtNumber(total)}`}
                </span>
              </div>
              <div className="table-wrap funnel-table">
                <table className="compare-table">
                  <thead>
                    <tr>
                      <th>Cohort</th>
                      <th>Country</th>
                      <th>Channel</th>
                      <th>Installs</th>
                      <th>LTV-30</th>
                      <th>LTV-90</th>
                      <th>LTV-180</th>
                      <th>Paid rate 30</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={`${r.cohort_date}-${r.country}-${r.install_channel}-${safePage}-${i}`}>
                        <td>{String(r.cohort_date).slice(0, 10)}</td>
                        <td>{r.country || 'Unknown'}</td>
                        <td style={{ color: CHANNEL_COLOR[String(r.install_channel)] || 'inherit' }}>
                          {r.install_channel}
                        </td>
                        <td>{fmtNumber(num(r.installs))}</td>
                        <td>{fmtUsd(finite(r.ltv_30))}</td>
                        <td>{fmtUsd(finite(r.ltv_90))}</td>
                        <td>{fmtUsd(finite(r.ltv_180))}</td>
                        <td className="muted">{r.paid_rate_30 == null ? '—' : fmtPercent(Number(r.paid_rate_30))}</td>
                      </tr>
                    ))}
                    {!q.isLoading && rows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                          No rows for these filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="ltv-pagination">
                <label>
                  Rows
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <div className="ltv-pagination-btns">
                  <button
                    type="button"
                    disabled={safePage <= 0}
                    onClick={() => setPage(safePage - 1)}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={16} />
                    Prev
                  </button>
                  <span className="muted small">
                    Page {safePage + 1} of {pageCount}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= pageCount - 1}
                    onClick={() => setPage(safePage + 1)}
                    aria-label="Next page"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </ChartCard>
          </>
        )}
      </div>
    </>
  );
}
