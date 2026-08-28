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

type MixRow = {
  event_date?: string;
  unique_users?: number;
  new_users?: number;
  returning_users?: number;
  one_time_users?: number;
  repeat_users?: number;
  opens?: number;
  opens_per_user?: number;
  returning_share?: number;
  repeat_share?: number;
  range_unique_users?: number;
  range_new_users?: number;
  range_returning_users?: number;
  range_one_day_users?: number;
  range_multi_day_users?: number;
  range_opens?: number;
  range_opens_per_user?: number;
  range_returning_share?: number;
  range_multi_day_share?: number;
};

function n(v: unknown) {
  return Number(v || 0);
}

export default function UserMixPage({ params, setParams, applyFilters }: Props) {
  const { product, isCompare } = useProduct();
  const { chart } = useTheme();
  const q = useDashboardMetric('user-mix', params, !isCompare);
  const rows = (q.data || []) as MixRow[];
  const tot = rows[0] || {};

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
          <h2>Unique vs repeat users</h2>
          <p>
            Who used {product.shortName} once, who came back, and who opened again the same day
          </p>
        </div>
        <FilterBar params={params} onChange={setParams} onApply={applyFilters} />
      </div>

      <div className="page-content">
        {isCompare && (
          <div className="empty-state">
            Select <strong>Banknote</strong> or <strong>Coinzy</strong> (not Compare) to inspect unique vs repeat users.
          </div>
        )}

        {!isCompare && q.isLoading && <div className="empty-state">Loading user mix…</div>}
        {!isCompare && q.error && <div className="empty-state error">{q.error.message}</div>}

        {!isCompare && !q.isLoading && !q.error && rows.length === 0 && (
          <div className="empty-state">No complete export days in this range.</div>
        )}

        {!isCompare && !q.isLoading && !q.error && rows.length > 0 && (
          <>
            <div className="page-hint funnel-guide">
              <p>
                <strong>What this page answers:</strong> Are we only getting new people, or do they come back?
                Do they open once and leave, or open again?
              </p>
              <ul>
                <li>
                  <strong>Unique people</strong> in the range = anyone who opened the app or started a session
                  at least once (<code>session_start</code>, <code>App_open</code>, <code>first_open</code>).
                </li>
                <li>
                  <strong>New</strong> = they fired <code>first_open</code> in this range (first time we saw them).
                </li>
                <li>
                  <strong>Returning</strong> = they used the app but did <em>not</em> first-open in this range
                  (they were already users).
                </li>
                <li>
                  <strong>One day only</strong> = they showed up on exactly one day in this range. That is the
                  “tried it and left” gap.
                </li>
                <li>
                  <strong>Came back (2+ days)</strong> = they used the app on more than one day. That is stickiness.
                </li>
                <li>
                  Daily chart <strong>Once / Again same day</strong> is different: one open vs two or more opens
                  <em>on that calendar day</em>.
                </li>
              </ul>
            </div>

            <div className="funnel-kpis multi">
              <div className="funnel-kpi">
                <span className="funnel-kpi-label">Unique people</span>
                <span className="funnel-kpi-value">{fmtNumber(n(tot.range_unique_users))}</span>
                <span className="funnel-kpi-sub">Used the app at least once in this range</span>
              </div>
              <div className="funnel-kpi">
                <span className="funnel-kpi-label">New</span>
                <span className="funnel-kpi-value">{fmtNumber(n(tot.range_new_users))}</span>
                <span className="funnel-kpi-sub">
                  First-time open · {fmtPercent(n(tot.range_unique_users) ? n(tot.range_new_users) / n(tot.range_unique_users) : 0)} of unique
                </span>
              </div>
              <div className="funnel-kpi">
                <span className="funnel-kpi-label">Returning</span>
                <span className="funnel-kpi-value">{fmtNumber(n(tot.range_returning_users))}</span>
                <span className="funnel-kpi-sub">
                  Already users · {fmtPercent(n(tot.range_returning_share))} of unique
                </span>
              </div>
              <div className="funnel-kpi">
                <span className="funnel-kpi-label">One day only</span>
                <span className="funnel-kpi-value">{fmtNumber(n(tot.range_one_day_users))}</span>
                <span className="funnel-kpi-sub">Showed up once in this range — the drop-off gap</span>
              </div>
              <div className="funnel-kpi">
                <span className="funnel-kpi-label">Came back (2+ days)</span>
                <span className="funnel-kpi-value">{fmtNumber(n(tot.range_multi_day_users))}</span>
                <span className="funnel-kpi-sub">{fmtPercent(n(tot.range_multi_day_share))} of unique people</span>
              </div>
              <div className="funnel-kpi">
                <span className="funnel-kpi-label">Opens / person</span>
                <span className="funnel-kpi-value">
                  {n(tot.range_opens_per_user).toFixed(2)}
                </span>
                <span className="funnel-kpi-sub">{fmtNumber(n(tot.range_opens))} qualifying opens in range</span>
              </div>
            </div>

            <ChartCard title="Each day: new vs returning" loading={q.isLoading}>
              <p className="funnel-note" style={{ marginTop: 0 }}>
                Stack equals unique people that day. New = first_open that day. Returning = opened without first_open.
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartRows} stackOffset="none">
                  <CartesianGrid stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: chart.tick, fontSize: 11 }} />
                  <YAxis tick={{ fill: chart.tick, fontSize: 11 }} />
                  <Tooltip contentStyle={tipStyle} />
                  <Legend />
                  <Bar dataKey="new_users" name="New" stackId="u" fill="#fbbf24" />
                  <Bar dataKey="returning_users" name="Returning" stackId="u" fill="#4f8cff" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Each day: opened once vs opened again">
              <p className="funnel-note" style={{ marginTop: 0 }}>
                Same-day habit. High “once” and low “again” means people open and leave. Line is unique people that day.
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartRows}>
                  <CartesianGrid stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: chart.tick, fontSize: 11 }} />
                  <YAxis tick={{ fill: chart.tick, fontSize: 11 }} />
                  <Tooltip contentStyle={tipStyle} />
                  <Legend />
                  <Bar dataKey="one_time_users" name="Once that day" stackId="r" fill="#94a3b8" />
                  <Bar dataKey="repeat_users" name="Again same day" stackId="r" fill="#059669" />
                  <Line type="monotone" dataKey="unique_users" name="Unique people" stroke="#4f8cff" dot={false} strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Every day in detail">
              <div className="table-wrap funnel-table">
                <table>
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Unique people</th>
                      <th>New</th>
                      <th>Returning</th>
                      <th>Returning %</th>
                      <th>Once that day</th>
                      <th>Again same day</th>
                      <th>Again %</th>
                      <th>Opens</th>
                      <th>Opens / person</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={String(r.event_date)}>
                        <td>{String(r.event_date || '').slice(0, 10)}</td>
                        <td>{fmtNumber(n(r.unique_users))}</td>
                        <td>{fmtNumber(n(r.new_users))}</td>
                        <td>{fmtNumber(n(r.returning_users))}</td>
                        <td>{fmtPercent(n(r.returning_share))}</td>
                        <td>{fmtNumber(n(r.one_time_users))}</td>
                        <td>{fmtNumber(n(r.repeat_users))}</td>
                        <td>{fmtPercent(n(r.repeat_share))}</td>
                        <td>{fmtNumber(n(r.opens))}</td>
                        <td>{n(r.opens_per_user).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          </>
        )}
      </div>
    </>
  );
}
