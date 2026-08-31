import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Line,
  LabelList,
  Cell,
} from 'recharts';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
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
  grain?: string;
  event_date?: string | null;
  hit_users?: number;
  hit_hits?: number;
  consumed_users?: number;
  consumed_hits?: number;
  blocked_users?: number;
  blocked_hits?: number;
  popup_users?: number;
  popup_hits?: number;
  go_premium_users?: number;
  go_premium_hits?: number;
  not_now_users?: number;
  not_now_hits?: number;
  fail_exhausted_users?: number;
  fail_exhausted_hits?: number;
  reset_users?: number;
  reset_hits?: number;
};

const HIT_USERS = '#F0A924';
const HIT_HITS = '#c9787a';
const AFTER_FILL = ['#7C3C3F', '#9a5659', '#c9787a', '#4f8cff', '#8b93a7'];

function n(v: unknown) {
  return Number(v || 0);
}

function rate(num: number, den: number) {
  return den > 0 ? num / den : null;
}

function pct(n: number | null) {
  return n == null ? '—' : fmtPercent(n);
}

function DailyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="quota-tooltip">
      <div className="quota-tooltip-label">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="quota-tooltip-row">
          <i style={{ background: p.color }} />
          <span>{p.name}</span>
          <strong>{fmtNumber(Number(p.value || 0))}</strong>
        </div>
      ))}
    </div>
  );
}

function AfterHitTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { step: string; People: number; ofHit: number | null } }>;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="quota-tooltip">
      <div className="quota-tooltip-label">{row.step}</div>
      <div className="quota-tooltip-row">
        <span>Unique people</span>
        <strong>{fmtNumber(row.People)}</strong>
      </div>
      <div className="quota-tooltip-row">
        <span>Of quota hit</span>
        <strong>{pct(row.ofHit)}</strong>
      </div>
    </div>
  );
}

function KpiSkeletonRow({ count }: { count: number }) {
  return (
    <div className="kpi-row">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="kpi-card">
          <Skeleton width={92} height={11} />
          <Skeleton width={76} height={28} style={{ marginTop: 8 }} />
          <Skeleton width="68%" height={11} style={{ marginTop: 10 }} />
        </div>
      ))}
    </div>
  );
}

function QuotaSkeleton() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return (
    <SkeletonTheme
      baseColor={dark ? '#222632' : '#e6eaf2'}
      highlightColor={dark ? '#2e3446' : '#f4f6fa'}
      borderRadius={8}
      duration={1.2}
    >
      <div className="quota-skeleton" aria-busy="true" aria-live="polite">
        <Skeleton height={108} style={{ marginBottom: 20, borderRadius: 10 }} />
        <Skeleton width={140} height={13} style={{ marginBottom: 10 }} />
        <KpiSkeletonRow count={4} />
        <Skeleton width={180} height={13} style={{ margin: '8px 0 10px' }} />
        <KpiSkeletonRow count={4} />
        <Skeleton width={220} height={13} style={{ margin: '8px 0 10px' }} />
        <KpiSkeletonRow count={2} />
        <div className="chart-grid">
          <div className="chart-card half">
            <Skeleton width={240} height={14} />
            <Skeleton height={300} style={{ marginTop: 16 }} />
          </div>
          <div className="chart-card half">
            <Skeleton width={210} height={14} />
            <Skeleton height={300} style={{ marginTop: 16 }} />
          </div>
        </div>
      </div>
    </SkeletonTheme>
  );
}

export default function FreeScanQuotaPage({ params, setParams, applyFilters }: Props) {
  const { product, productId, isCompare } = useProduct();
  const { chart } = useTheme();
  const isCoinzy = productId === 'coinzy';
  const q = useDashboardMetric('free-scan-quota', params, !isCompare && isCoinzy);
  const rows = (q.data || []) as Row[];

  const range = useMemo(
    () => rows.find((r) => String(r.grain) === 'range') || null,
    [rows],
  );
  const daily = useMemo(
    () => rows.filter((r) => String(r.grain) === 'day'),
    [rows],
  );

  const tot = useMemo(() => {
    const hitUsers = n(range?.hit_users);
    const hitHits = n(range?.hit_hits);
    const consumedUsers = n(range?.consumed_users);
    const consumedHits = n(range?.consumed_hits);
    const blockedUsers = n(range?.blocked_users);
    const popupUsers = n(range?.popup_users);
    const goPremiumUsers = n(range?.go_premium_users);
    const notNowUsers = n(range?.not_now_users);
    const failUsers = n(range?.fail_exhausted_users);
    const resetUsers = n(range?.reset_users);
    return {
      hitUsers,
      hitHits,
      consumedUsers,
      consumedHits,
      blockedUsers,
      blockedHits: n(range?.blocked_hits),
      popupUsers,
      popupHits: n(range?.popup_hits),
      goPremiumUsers,
      goPremiumHits: n(range?.go_premium_hits),
      notNowUsers,
      notNowHits: n(range?.not_now_hits),
      failUsers,
      failHits: n(range?.fail_exhausted_hits),
      resetUsers,
      resetHits: n(range?.reset_hits),
      hitsPerUser: rate(hitHits, hitUsers),
      hitOfConsumed: rate(hitUsers, consumedUsers),
      blockedOfHit: rate(blockedUsers, hitUsers),
      popupOfHit: rate(popupUsers, hitUsers),
      goPremiumOfPopup: rate(goPremiumUsers, popupUsers),
      notNowOfPopup: rate(notNowUsers, popupUsers),
    };
  }, [range]);

  const chartRows = useMemo(
    () =>
      daily.map((r) => ({
        day: String(r.event_date || '').slice(5),
        'Hit users': n(r.hit_users),
        'Hit hits': n(r.hit_hits),
      })),
    [daily],
  );

  const afterHitChart = useMemo(
    () =>
      [
        { step: 'Quota hit', People: tot.hitUsers },
        { step: 'Tried again', People: tot.blockedUsers },
        { step: 'Limit popup', People: tot.popupUsers },
        { step: 'Go premium', People: tot.goPremiumUsers },
        { step: 'Not now', People: tot.notNowUsers },
      ].map((s) => ({ ...s, ofHit: rate(s.People, tot.hitUsers) })),
    [tot],
  );

  const showData = isCoinzy && !isCompare && !q.isLoading && !q.error && (range || daily.length > 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Free-scan success quota</h2>
          <p>
            Coinzy experiment: quota is hit when success remaining goes from &gt;0 to 0
            {' '}({product.shortName})
          </p>
        </div>
        <FilterBar params={params} onChange={setParams} onApply={applyFilters} />
      </div>

      <div className="page-content">
        {isCompare && (
          <div className="empty-state">
            Select <strong>Coinzy</strong> (not Compare) for this experiment tab.
          </div>
        )}

        {!isCompare && !isCoinzy && (
          <div className="empty-state warn">
            Banknote events for this experiment are not mapped yet. Share the Banknote
            event names and we will add them here. MVP tab{' '}
            <NavLink to="/mvp/quota-hit">4. Quota hit</NavLink> still uses the older mixed
            limit events.
          </div>
        )}

        {isCoinzy && !isCompare && q.isLoading && <QuotaSkeleton />}
        {isCoinzy && !isCompare && q.error && (
          <div className="empty-state error">{q.error.message}</div>
        )}
        {isCoinzy && !isCompare && !q.isLoading && !q.error && daily.length === 0 && !range && (
          <div className="empty-state">No complete export days in this range.</div>
        )}

        {showData && (
          <>
            <div className="page-hint funnel-guide">
              <p>
                <strong>Hit</strong> = unique people / hits of{' '}
                <code>free_scan_success_quota_exhausted</code> only. That fires when
                success remaining goes from &gt;0 → 0. KPIs below are unique people in
                the selected range. The chart is unique people per day.
              </p>
              <ul>
                <li>
                  <code>free_scan_success_consumed</code> is every successful scan counted
                  against quota — <strong>not</strong> a hit.
                </li>
                <li>
                  After hit: <code>free_scan_blocked</code> = tried to scan again.{' '}
                  <code>free_scan_limit_exceeded</code> = exhausted-limit popup.{' '}
                  <code>free_scan_go_premium_tapped</code> /{' '}
                  <code>free_scan_not_now_tapped</code> = popup actions.
                </li>
                <li>
                  <code>free_scan_fail_quota_exhausted</code> is informational — fail
                  quota reaching 0 does not block scanning.{' '}
                  <code>free_scan_quota_reset</code> is the daily 24-hour reset.
                </li>
                <li>
                  Not used: <code>Identified_limit_reached</code>,{' '}
                  <code>Collection_limit_Reached</code>. Older mixed limits stay on{' '}
                  <NavLink to="/mvp/quota-hit">4. Quota hit</NavLink> and{' '}
                  <NavLink to="/scan-limits">Scan limits</NavLink>.
                </li>
              </ul>
            </div>

            <h3 className="section-label">Success quota hit</h3>
            <div className="kpi-row">
              <div className="kpi-card">
                <div className="label">Hit users</div>
                <div className="value">{fmtNumber(tot.hitUsers)}</div>
                <div className="why">Unique people · exhausted event</div>
              </div>
              <div className="kpi-card">
                <div className="label">Hit hits</div>
                <div className="value">{fmtNumber(tot.hitHits)}</div>
                <div className="why">
                  {tot.hitsPerUser == null ? '—' : `${tot.hitsPerUser.toFixed(2)} per person`}
                </div>
              </div>
              <div className="kpi-card">
                <div className="label">Consumed (not a hit)</div>
                <div className="value">{fmtNumber(tot.consumedUsers)}</div>
                <div className="why">
                  {fmtNumber(tot.consumedHits)} successful scans against quota
                </div>
              </div>
              <div className="kpi-card">
                <div className="label">Hit ÷ consumed</div>
                <div className="value">{pct(tot.hitOfConsumed)}</div>
                <div className="why">Of people who consumed a success</div>
              </div>
            </div>

            <h3 className="section-label">After quota is exhausted</h3>
            <div className="kpi-row">
              <div className="kpi-card">
                <div className="label">Tried again (blocked)</div>
                <div className="value">{fmtNumber(tot.blockedUsers)}</div>
                <div className="why">
                  {pct(tot.blockedOfHit)} of hit · {fmtNumber(tot.blockedHits)} hits
                </div>
              </div>
              <div className="kpi-card">
                <div className="label">Limit popup shown</div>
                <div className="value">{fmtNumber(tot.popupUsers)}</div>
                <div className="why">
                  {pct(tot.popupOfHit)} of hit · {fmtNumber(tot.popupHits)} hits
                </div>
              </div>
              <div className="kpi-card">
                <div className="label">Go premium</div>
                <div className="value">{fmtNumber(tot.goPremiumUsers)}</div>
                <div className="why">
                  {pct(tot.goPremiumOfPopup)} of popup · {fmtNumber(tot.goPremiumHits)} hits
                </div>
              </div>
              <div className="kpi-card">
                <div className="label">Not now</div>
                <div className="value">{fmtNumber(tot.notNowUsers)}</div>
                <div className="why">
                  {pct(tot.notNowOfPopup)} of popup · {fmtNumber(tot.notNowHits)} hits
                </div>
              </div>
            </div>

            <h3 className="section-label">Informational (does not block scanning)</h3>
            <div className="kpi-row">
              <div className="kpi-card">
                <div className="label">Fail quota exhausted</div>
                <div className="value">{fmtNumber(tot.failUsers)}</div>
                <div className="why">{fmtNumber(tot.failHits)} hits · does not block</div>
              </div>
              <div className="kpi-card">
                <div className="label">Daily quota reset</div>
                <div className="value">{fmtNumber(tot.resetUsers)}</div>
                <div className="why">{fmtNumber(tot.resetHits)} hits · 24-hour reset</div>
              </div>
            </div>

            <div className="chart-grid">
              <ChartCard className="half" title="Quota hit by day">
                <ResponsiveContainer width="100%" height={360}>
                  <ComposedChart data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: chart.tick, fontSize: 11 }} />
                    <YAxis
                      yAxisId="users"
                      tick={{ fill: chart.tick, fontSize: 11 }}
                      tickFormatter={(v) => fmtNumber(Number(v))}
                    />
                    <YAxis
                      yAxisId="hits"
                      orientation="right"
                      tick={{ fill: chart.tick, fontSize: 11 }}
                      tickFormatter={(v) => fmtNumber(Number(v))}
                    />
                    <Tooltip content={<DailyTooltip />} />
                    <Legend />
                    <Bar
                      yAxisId="users"
                      dataKey="Hit users"
                      fill={HIT_USERS}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                    <Line
                      yAxisId="hits"
                      type="monotone"
                      dataKey="Hit hits"
                      stroke={HIT_HITS}
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard className="half" title="After hit (unique people in range)">
                <ResponsiveContainer width="100%" height={360}>
                  <BarChart
                    data={afterHitChart}
                    layout="vertical"
                    margin={{ top: 8, right: 48, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: chart.tick, fontSize: 11 }}
                      tickFormatter={(v) => fmtNumber(Number(v))}
                    />
                    <YAxis
                      type="category"
                      dataKey="step"
                      width={108}
                      tick={{ fill: chart.tick, fontSize: 11 }}
                    />
                    <Tooltip content={<AfterHitTooltip />} />
                    <Bar dataKey="People" radius={[0, 4, 4, 0]} maxBarSize={22}>
                      {afterHitChart.map((row, i) => (
                        <Cell key={row.step} fill={AFTER_FILL[i] || HIT_HITS} />
                      ))}
                      <LabelList
                        dataKey="People"
                        position="right"
                        fill="var(--text-muted)"
                        fontSize={11}
                        formatter={(v: number) => fmtNumber(Number(v))}
                      />
                    </Bar>
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
