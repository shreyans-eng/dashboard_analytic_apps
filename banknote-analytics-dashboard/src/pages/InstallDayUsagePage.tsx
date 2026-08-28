import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
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

type Row = {
  event_date?: string;
  installs?: number;
  went_in?: number;
  went_in_rate?: number;
  total_seconds_went_in?: number;
  avg_seconds?: number;
  median_seconds?: number;
  time_p10?: number;
  time_p25?: number;
  time_p50?: number;
  time_p75?: number;
  time_p90?: number;
  time_p95?: number;
  time_p99?: number;
};

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

export default function InstallDayUsagePage({ params, setParams, applyFilters }: Props) {
  const { product, isCompare } = useProduct();
  const { chart } = useTheme();
  const q = useDashboardMetric('install-day-usage', params, !isCompare);
  const rows = (q.data || []) as Row[];

  const totals = useMemo(() => {
    const installs = rows.reduce((s, r) => s + n(r.installs), 0);
    const wentIn = rows.reduce((s, r) => s + n(r.went_in), 0);
    const totalSec = rows.reduce((s, r) => s + n(r.total_seconds_went_in), 0);
    let medWeight = 0;
    let medAcc = 0;
    for (const r of rows) {
      const w = n(r.went_in);
      const m = Number(r.median_seconds);
      if (w > 0 && Number.isFinite(m) && m >= 0) {
        medWeight += w;
        medAcc += m * w;
      }
    }
    return {
      installs,
      wentIn,
      rate: installs > 0 ? wentIn / installs : 0,
      avgSec: wentIn > 0 ? totalSec / wentIn : 0,
      medianSec: medWeight > 0 ? medAcc / medWeight : 0,
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
        day: String(r.event_date || '').slice(5),
      })),
    [rows],
  );

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Installs, who went in, time used</h2>
          <p>
            Of people who installed {product.shortName} that day, how many stayed in the app, and for how long
          </p>
        </div>
        <FilterBar params={params} onChange={setParams} onApply={applyFilters} />
      </div>

      <div className="page-content">
        {isCompare && (
          <div className="empty-state">
            Select <strong>Banknote</strong> or <strong>Coinzy</strong> (not Compare) to see install-day usage.
          </div>
        )}

        {!isCompare && q.isLoading && <div className="empty-state">Loading install-day usage…</div>}
        {!isCompare && q.error && <div className="empty-state error">{q.error.message}</div>}

        {!isCompare && !q.isLoading && !q.error && rows.length === 0 && (
          <div className="empty-state">No complete export days in this range.</div>
        )}

        {!isCompare && !q.isLoading && !q.error && rows.length > 0 && (
          <>
            <div className="page-hint funnel-guide">
              <p>
                <strong>Installs</strong> are devices with <code>first_open</code> that calendar day
                (<code>user_pseudo_id</code>, same as same-day first ID).
              </p>
              <ul>
                <li>
                  <strong>Went in</strong> = that device spent at least <strong>10 seconds</strong> in the app
                  the same day (Firebase <code>user_engagement</code> time, or app <code>session_length_seconds</code>).
                </li>
                <li>
                  <strong>Time used</strong> is how long those people stayed on the install day.
                  P10–P99 (including P90) are among people who went in 10s+.
                </li>
                <li>
                  Opening the store listing is not enough. <code>first_open</code> means they launched the app;
                  “went in” means they actually stayed.
                </li>
              </ul>
            </div>

            <div className="kpi-row">
              <div className="kpi-card">
                <div className="label">Installs</div>
                <div className="value">{fmtNumber(totals.installs)}</div>
              </div>
              <div className="kpi-card">
                <div className="label">Went in (10s+)</div>
                <div className="value">{fmtNumber(totals.wentIn)}</div>
              </div>
              <div className="kpi-card">
                <div className="label">Went-in rate</div>
                <div className="value">{fmtPercent(totals.rate)}</div>
              </div>
              <div className="kpi-card">
                <div className="label">Typical time</div>
                <div className="value">{fmtDuration(totals.medianSec)}</div>
              </div>
              <div className="kpi-card">
                <div className="label">Average time</div>
                <div className="value">{fmtDuration(totals.avgSec)}</div>
              </div>
            </div>

            <div className="chart-grid">
              <ChartCard title="Installs vs who went in">
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={chartRows}>
                    <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fill: chart.tick, fontSize: 11 }} />
                    <YAxis tick={{ fill: chart.tick, fontSize: 11 }} />
                    <Tooltip contentStyle={tipStyle} />
                    <Legend />
                    <Bar dataKey="installs" name="Installs" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="went_in" name="Went in (10s+)" fill="#4f8cff" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Time in app on install day">
                <ResponsiveContainer width="100%" height={360}>
                  <ComposedChart data={chartRows}>
                    <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fill: chart.tick, fontSize: 11 }} />
                    <YAxis
                      tick={{ fill: chart.tick, fontSize: 11 }}
                      tickFormatter={(v) => fmtDuration(Number(v))}
                    />
                    <Tooltip
                      contentStyle={tipStyle}
                      formatter={(v: number) => fmtDuration(Number(v))}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="median_seconds"
                      name="Typical time"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="avg_seconds"
                      name="Average time"
                      stroke="#a78bfa"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="time_p10"
                      name="P10"
                      stroke="#94a3b8"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="time_p90"
                      name="P90"
                      stroke="#fb923c"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="time_p99"
                      name="P99"
                      stroke="#f87171"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <h3 className="section-label">Time used on install day (P10–P99, among 10s+)</h3>
            <div className="results-table-wrap">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Date</th>
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
                      <td>{fmtDuration(n(r.time_p10))}</td>
                      <td>{fmtDuration(n(r.time_p25))}</td>
                      <td>{fmtDuration(n(r.time_p50 || r.median_seconds))}</td>
                      <td>{fmtDuration(n(r.time_p75))}</td>
                      <td>{fmtDuration(n(r.time_p90))}</td>
                      <td>{fmtDuration(n(r.time_p95))}</td>
                      <td>{fmtDuration(n(r.time_p99))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
