import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import FilterBar from '@/components/FilterBar';
import ChartCard from '@/components/ChartCard';
import { useDashboardMetric } from '@/hooks/useAnalytics';
import { fmtNumber, fmtPercent, QueryParams } from '@/lib/api';
import { useProduct } from '@/lib/product';
import { useTheme } from '@/lib/theme';

interface Props {
  params: QueryParams;
  setParams: (p: QueryParams) => void;
  applyFilters: () => void;
}

const P = [10, 25, 50, 75, 90, 95, 99] as const;
const P_COLORS: Record<number, string> = {
  10: '#94a3b8',
  25: '#67e8f9',
  50: '#4f8cff',
  75: '#34d399',
  90: '#fb923c',
  95: '#fbbf24',
  99: '#f87171',
};

type Row = Record<string, unknown>;

function n(v: unknown) {
  return Number(v || 0);
}

function fmtDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function fmtScan(v: unknown) {
  const x = Number(v);
  if (!Number.isFinite(x)) return '—';
  if (x >= 100) return fmtNumber(x);
  return x.toFixed(1);
}

function weighted(rows: Row[], valueKey: string, weightKey: string) {
  let w = 0;
  let acc = 0;
  for (const r of rows) {
    const wt = n(r[weightKey]);
    const v = Number(r[valueKey]);
    if (wt > 0 && Number.isFinite(v) && v >= 0) {
      w += wt;
      acc += v * wt;
    }
  }
  return w > 0 ? acc / w : null;
}

export default function PercentilesPage({ params, setParams, applyFilters }: Props) {
  const { product, isCompare } = useProduct();
  const { chart } = useTheme();
  const q = useDashboardMetric('d0-d1-percentiles', params, !isCompare);
  const rows = (q.data || []) as Row[];

  const tot = useMemo(() => {
    const installs = rows.reduce((s, r) => s + n(r.installs), 0);
    const d0 = rows.reduce((s, r) => s + n(r.d0_went_in), 0);
    const d1 = rows.reduce((s, r) => s + n(r.d1_retained), 0);
    return {
      installs,
      d0,
      d1,
      d0Rate: installs > 0 ? d0 / installs : 0,
      d1Rate: installs > 0 ? d1 / installs : 0,
      d0TimeP50: weighted(rows, 'd0_time_p50', 'installs'),
      d1TimeP50: weighted(rows, 'd1_time_p50', 'd1_retained'),
      d0ScansP50: weighted(rows, 'd0_scans_p50', 'installs'),
      d1ScansP50: weighted(rows, 'd1_scans_p50', 'd1_retained'),
    };
  }, [rows]);

  const tipStyle = useMemo(
    () => ({
      background: chart.tooltipBg,
      border: `1px solid ${chart.tooltipBorder}`,
      color: 'var(--text)',
    }),
    [chart],
  );

  const chartRows = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        day: String(r.cohort_date || '').slice(5),
      })),
    [rows],
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h2>D0 / D1 percentiles</h2>
          <p>
            Install cohort for {product.shortName}: time used, scans, and retain — P10, P25, P50, P75, P90, P95, P99
          </p>
        </div>
        <FilterBar params={params} onChange={setParams} onApply={applyFilters} />
      </div>

      <div className="page-content">
        {isCompare && (
          <div className="empty-state">
            Select <strong>Banknote</strong> or <strong>Coinzy</strong> (not Compare) for percentiles.
          </div>
        )}
        {!isCompare && q.isLoading && <div className="empty-state">Loading percentiles…</div>}
        {!isCompare && q.error && <div className="empty-state error">{q.error.message}</div>}
        {!isCompare && !q.isLoading && !q.error && rows.length === 0 && (
          <div className="empty-state">No complete export days in this range.</div>
        )}

        {!isCompare && !q.isLoading && !q.error && rows.length > 0 && (
          <>
            <div className="page-hint funnel-guide">
              <p>
                Each day is an <strong>install cohort</strong> (<code>first_open</code> devices).
                D0 is that day. D1 is the next calendar day. Time and scan percentiles include
                people with 0 (D0 = all installs; D1 = people who opened, including 0s). Went in
                (≥10s) is a separate retain rate, not the percentile population.
              </p>
              <ul>
                <li>
                  <strong>Retain D0</strong> = went in (≥10s). <strong>Retain D1</strong> = opened
                  the app (<code>session_start</code> / <code>App_open</code> /{' '}
                  <code>first_open</code>). Same definition as MVP 6 and Explorer D1 — push is not
                  a return.
                </li>
                <li>
                  <strong>Scans / day</strong> = successful IDs among that same population
                  (including 0). Coinzy includes <code>Identification_done</code>. Daily DAU
                  scan percentiles stay on <strong>7. Scans / user</strong>.
                </li>
                <li>
                  P50 is the typical person. P90/P99 are the heavy users. A few power users cannot
                  hide behind the average.
                </li>
              </ul>
            </div>

            <div className="kpi-row">
              <div className="kpi-card">
                <div className="label">Installs</div>
                <div className="value">{fmtNumber(tot.installs)}</div>
              </div>
              <div className="kpi-card">
                <div className="label">D0 went in</div>
                <div className="value">{fmtPercent(tot.d0Rate)}</div>
                <div className="why">{fmtNumber(tot.d0)} people · 10s+</div>
              </div>
              <div className="kpi-card">
                <div className="label">D1 returned</div>
                <div className="value">{fmtPercent(tot.d1Rate)}</div>
                <div className="why">{fmtNumber(tot.d1)} opened the app next day</div>
              </div>
              <div className="kpi-card">
                <div className="label">D0 time P50</div>
                <div className="value">{tot.d0TimeP50 == null ? '—' : fmtDuration(tot.d0TimeP50)}</div>
              </div>
              <div className="kpi-card">
                <div className="label">D0 scans P50</div>
                <div className="value">{tot.d0ScansP50 == null ? '—' : fmtScan(tot.d0ScansP50)}</div>
              </div>
              <div className="kpi-card">
                <div className="label">D1 scans P50</div>
                <div className="value">{tot.d1ScansP50 == null ? '—' : fmtScan(tot.d1ScansP50)}</div>
              </div>
            </div>

            <div className="chart-grid">
              <ChartCard title="Retain: D0 went in vs D1 opened the app">
                <ResponsiveContainer width="100%" height={360}>
                  <LineChart data={chartRows}>
                    <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fill: chart.tick, fontSize: 11 }} />
                    <YAxis
                      tick={{ fill: chart.tick, fontSize: 11 }}
                      tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
                    />
                    <Tooltip
                      contentStyle={tipStyle}
                      formatter={(v: number) => fmtPercent(Number(v))}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="d0_went_in_rate" name="D0 went in" stroke="#4f8cff" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="d1_retention_rate" name="D1 returned" stroke="#34d399" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Install time (seconds, all installs / D1 openers)">
                <ResponsiveContainer width="100%" height={360}>
                  <LineChart data={chartRows}>
                    <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fill: chart.tick, fontSize: 11 }} />
                    <YAxis tick={{ fill: chart.tick, fontSize: 11 }} tickFormatter={(v) => fmtDuration(Number(v))} />
                    <Tooltip contentStyle={tipStyle} formatter={(v: number) => fmtDuration(Number(v))} />
                    <Legend />
                    <Line type="monotone" dataKey="d0_time_p50" name="D0 P50" stroke="#4f8cff" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="d0_time_p90" name="D0 P90" stroke="#fb923c" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="d1_time_p50" name="D1 P50" stroke="#34d399" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="d1_time_p90" name="D1 P90" stroke="#fbbf24" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Scans per day (all installs / D1 openers, including 0)">
                <ResponsiveContainer width="100%" height={360}>
                  <LineChart data={chartRows}>
                    <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fill: chart.tick, fontSize: 11 }} />
                    <YAxis tick={{ fill: chart.tick, fontSize: 11 }} />
                    <Tooltip contentStyle={tipStyle} />
                    <Legend />
                    <Line type="monotone" dataKey="d0_scans_p50" name="D0 P50" stroke="#4f8cff" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="d0_scans_p90" name="D0 P90" stroke="#fb923c" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="d1_scans_p50" name="D1 P50" stroke="#34d399" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="d1_scans_p90" name="D1 P90" stroke="#fbbf24" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <h3 className="section-label">Install time — D0 (all installs)</h3>
            <PercentileTable
              rows={rows}
              dateKey="cohort_date"
              prefix="d0_time_p"
              format={fmtDuration}
            />
            <h3 className="section-label">Install time — D1 (people who opened, including 0s)</h3>
            <PercentileTable
              rows={rows}
              dateKey="cohort_date"
              prefix="d1_time_p"
              format={fmtDuration}
            />
            <h3 className="section-label">Scans per day — D0 (all installs)</h3>
            <PercentileTable
              rows={rows}
              dateKey="cohort_date"
              prefix="d0_scans_p"
              format={fmtScan}
            />
            <h3 className="section-label">Scans per day — D1 (people who opened, including 0s)</h3>
            <PercentileTable
              rows={rows}
              dateKey="cohort_date"
              prefix="d1_scans_p"
              format={fmtScan}
            />
          </>
        )}
      </div>
    </>
  );
}

function PercentileTable({
  rows,
  dateKey,
  prefix,
  format,
}: {
  rows: Row[];
  dateKey: string;
  prefix: string;
  format: (v: number) => string;
}) {
  return (
    <div className="results-table-wrap" style={{ marginBottom: 20 }}>
      <table className="results-table">
        <thead>
          <tr>
            <th>Date</th>
            {P.map((p) => (
              <th key={p}>P{p}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r[dateKey])}>
              <td>{String(r[dateKey] ?? '').slice(0, 10)}</td>
              {P.map((p) => {
                const v = r[`${prefix}${p}`];
                return (
                  <td key={p} style={{ color: P_COLORS[p] }}>
                    {v == null || v === '' ? '—' : format(Number(v))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
