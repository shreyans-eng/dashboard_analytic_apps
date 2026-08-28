import { useMemo } from 'react';
import {
  BarChart,
  Bar,
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

type Row = {
  event_date?: string;
  free_scanners?: number;
  subscribed_scanners?: number;
  free_success_limit_users?: number;
  free_fail_limit_users?: number;
  subscribed_success_limit_users?: number;
  subscribed_fail_limit_users?: number;
};

function n(v: unknown) {
  return Number(v || 0);
}

function rate(num: number, den: number) {
  return den > 0 ? num / den : 0;
}

export default function ScanLimitsPage({ params, setParams, applyFilters }: Props) {
  const { product, isCompare } = useProduct();
  const { chart } = useTheme();
  const q = useDashboardMetric('scan-limits', params, !isCompare);
  const rows = (q.data || []) as Row[];

  const tot = useMemo(() => {
    const freeScanners = rows.reduce((s, r) => s + n(r.free_scanners), 0);
    const subScanners = rows.reduce((s, r) => s + n(r.subscribed_scanners), 0);
    const freeSuccess = rows.reduce((s, r) => s + n(r.free_success_limit_users), 0);
    const freeFail = rows.reduce((s, r) => s + n(r.free_fail_limit_users), 0);
    const subSuccess = rows.reduce((s, r) => s + n(r.subscribed_success_limit_users), 0);
    const subFail = rows.reduce((s, r) => s + n(r.subscribed_fail_limit_users), 0);
    return {
      freeScanners,
      subScanners,
      freeSuccess,
      freeFail,
      subSuccess,
      subFail,
      freeSuccessRate: rate(freeSuccess, freeScanners),
      freeFailRate: rate(freeFail, freeScanners),
      subSuccessRate: rate(subSuccess, subScanners),
      subFailRate: rate(subFail, subScanners),
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
          <h2>Scan limits: free vs subscribed</h2>
          <p>
            How many {product.shortName} scanners hit the successful-ID cap vs the unsuccessful-ID cap
          </p>
        </div>
        <FilterBar params={params} onChange={setParams} onApply={applyFilters} />
      </div>

      <div className="page-content">
        {isCompare && (
          <div className="empty-state">
            Select <strong>Banknote</strong> or <strong>Coinzy</strong> (not Compare) to see scan limits.
          </div>
        )}

        {!isCompare && q.isLoading && <div className="empty-state">Loading scan limits…</div>}
        {!isCompare && q.error && <div className="empty-state error">{q.error.message}</div>}
        {!isCompare && !q.isLoading && !q.error && rows.length === 0 && (
          <div className="empty-state">No complete export days in this range.</div>
        )}

        {!isCompare && !q.isLoading && !q.error && rows.length > 0 && (
          <>
            <div className="page-hint funnel-guide">
              <p>
                Counts are <strong>distinct people per day</strong> who attempted a scan (success or failure).
                Subscribed = they had a purchase on or before that day
                (<code>Subs_confirm</code> / <code>in_app_purchase</code> / lifetime). There is no separate
                Pro limit event in Firebase — Pro rows are the same limit events on paying users.
              </p>
              <ul>
                <li>
                  <strong>Free · success limit</strong> — used up free successful IDs
                  (<code>free_scan_success_quota_exhausted</code>, <code>Identified_limit_reached</code>,
                  <code>identiifcation_limit_exceeded</code>, <code>free_scan_limit_exceeded</code>).
                </li>
                <li>
                  <strong>Free · unsuccessful limit</strong> — used up free failed / no-match IDs
                  (<code>free_scan_fail_quota_exhausted</code>, <code>Identification_unsuccessful_limit_reached</code>).
                </li>
                <li>
                  Banknote currently fires almost only <code>identiifcation_limit_exceeded</code> (success-style cap).
                  Coinzy fires the split success / fail events.
                </li>
              </ul>
            </div>

            <h3 className="section-label">Free users</h3>
            <div className="kpi-row">
              <div className="kpi-card">
                <div className="label">Free scanners</div>
                <div className="value">{fmtNumber(tot.freeScanners)}</div>
              </div>
              <div className="kpi-card">
                <div className="label">Hit success limit</div>
                <div className="value">{fmtNumber(tot.freeSuccess)}</div>
                <div className="why">{fmtPercent(tot.freeSuccessRate)} of free scanners</div>
              </div>
              <div className="kpi-card">
                <div className="label">Hit unsuccessful limit</div>
                <div className="value">{fmtNumber(tot.freeFail)}</div>
                <div className="why">{fmtPercent(tot.freeFailRate)} of free scanners</div>
              </div>
            </div>

            <h3 className="section-label">Subscribed users</h3>
            <div className="kpi-row">
              <div className="kpi-card">
                <div className="label">Subscribed scanners</div>
                <div className="value">{fmtNumber(tot.subScanners)}</div>
              </div>
              <div className="kpi-card">
                <div className="label">Hit success limit</div>
                <div className="value">{fmtNumber(tot.subSuccess)}</div>
                <div className="why">{fmtPercent(tot.subSuccessRate)} of subscribed scanners</div>
              </div>
              <div className="kpi-card">
                <div className="label">Hit unsuccessful limit</div>
                <div className="value">{fmtNumber(tot.subFail)}</div>
                <div className="why">{fmtPercent(tot.subFailRate)} of subscribed scanners</div>
              </div>
            </div>

            <div className="chart-grid">
              <ChartCard title="Free: success limit vs unsuccessful limit">
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={chartRows}>
                    <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fill: chart.tick, fontSize: 11 }} />
                    <YAxis tick={{ fill: chart.tick, fontSize: 11 }} />
                    <Tooltip contentStyle={tipStyle} />
                    <Legend />
                    <Bar
                      dataKey="free_success_limit_users"
                      name="Success limit"
                      fill="#fbbf24"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="free_fail_limit_users"
                      name="Unsuccessful limit"
                      fill="#f87171"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Subscribed: success limit vs unsuccessful limit">
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart data={chartRows}>
                    <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fill: chart.tick, fontSize: 11 }} />
                    <YAxis tick={{ fill: chart.tick, fontSize: 11 }} />
                    <Tooltip contentStyle={tipStyle} />
                    <Legend />
                    <Bar
                      dataKey="subscribed_success_limit_users"
                      name="Success limit"
                      fill="#a78bfa"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="subscribed_fail_limit_users"
                      name="Unsuccessful limit"
                      fill="#fb7185"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </>
        )}
      </div>
    </>
  );
}
