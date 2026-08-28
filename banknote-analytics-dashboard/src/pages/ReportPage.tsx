import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ClipboardList } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import ChartCard from '@/components/ChartCard';
import {
  useDashboardMetric,
  useScopedDashboardMetric,
  useScopedFunnel,
  useScopedKpi,
} from '@/hooks/useAnalytics';
import { FunnelRow, QueryParams, fmtPercent } from '@/lib/api';
import { useProduct } from '@/lib/product';
import { useTheme } from '@/lib/theme';

interface Props {
  params: QueryParams;
  setParams: (p: QueryParams) => void;
  applyFilters: () => void;
}

type MixRow = {
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

type ScanRow = {
  cohort_users?: number;
  users_scanned_day0?: number;
  day0_first_scan_rate?: number;
  median_seconds_to_first_scan?: number;
};

type SummaryRow = {
  product?: string;
  dau?: number | null;
  notification_dau?: number | null;
  any_event_dau?: number | null;
  unique_users?: number;
  installs?: number;
  identification_success_rate?: number;
  open_to_success_rate?: number;
  scans_per_user_day?: number;
  free_quota_hit_rate?: number;
  paywall_to_confirm_rate?: number;
};

type DailyRow = {
  event_date?: string;
  product?: string;
  dau?: number;
  notification_dau?: number;
  any_event_dau?: number;
};

type PickItem = { pri: number; title: string; detail: string };

function n(v: unknown) {
  return Number(v || 0);
}

function isTrue(v: unknown) {
  return v === true || v === 1 || v === '1' || v === 'true';
}

function fmtCount(v: unknown) {
  const x = Number(v);
  if (!Number.isFinite(x)) return '—';
  return Math.round(x).toLocaleString('en-US');
}

function fmtRate(v: unknown) {
  const x = Number(v);
  if (!Number.isFinite(x)) return '—';
  return fmtPercent(x);
}

function fmtDuration(sec: unknown) {
  const s = Number(sec);
  if (!Number.isFinite(s) || s <= 0) return '—';
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${(s / 3600).toFixed(1)} h`;
}

function coreSteps(rows: FunnelRow[] | undefined) {
  return (rows || []).filter((r) => isTrue(r.is_core) && !isTrue(r.is_drop));
}

function stepUsers(rows: FunnelRow[] | undefined, id: string) {
  const row = (rows || []).find((r) => String(r.step_id) === id);
  return row ? n(row.users) : 0;
}

function biggestLeak(rows: FunnelRow[] | undefined) {
  const core = coreSteps(rows);
  let worst: { from: string; to: string; dropped: number; fromUsers: number; toUsers: number } | null = null;
  for (let i = 1; i < core.length; i++) {
    const fromUsers = n(core[i - 1].users);
    const toUsers = n(core[i].users);
    const dropped = fromUsers - toUsers;
    if (dropped <= 0) continue;
    if (!worst || dropped > worst.dropped) {
      worst = {
        from: String(core[i - 1].step_label || core[i - 1].step_id),
        to: String(core[i].step_label || core[i].step_id),
        dropped,
        fromUsers,
        toUsers,
      };
    }
  }
  return worst;
}

function rollupScan(rows: ScanRow[] | undefined) {
  const list = rows || [];
  const cohort = list.reduce((s, r) => s + n(r.cohort_users), 0);
  const scanned = list.reduce((s, r) => s + n(r.users_scanned_day0), 0);
  let medWeight = 0;
  let medAcc = 0;
  for (const r of list) {
    const w = n(r.users_scanned_day0);
    const m = Number(r.median_seconds_to_first_scan);
    if (w > 0 && Number.isFinite(m) && m > 0) {
      medWeight += w;
      medAcc += m * w;
    }
  }
  return {
    cohort,
    scanned,
    rate: cohort > 0 ? scanned / cohort : null as number | null,
    medianSec: medWeight > 0 ? medAcc / medWeight : null as number | null,
  };
}

function mixTotals(rows: MixRow[] | undefined) {
  const tot = (rows && rows[0]) || {};
  const unique = n(tot.range_unique_users);
  return {
    unique,
    newUsers: n(tot.range_new_users),
    returning: n(tot.range_returning_users),
    oneDay: n(tot.range_one_day_users),
    multiDay: n(tot.range_multi_day_users),
    opens: n(tot.range_opens),
    opensPerUser: n(tot.range_opens_per_user),
    oneDayShare: unique > 0 ? n(tot.range_one_day_users) / unique : n(tot.range_multi_day_share) ? 1 - n(tot.range_multi_day_share) : 0,
    multiShare: n(tot.range_multi_day_share),
  };
}

function matchProduct(rowProduct: string | undefined, label: string) {
  return String(rowProduct || '').toLowerCase() === String(label || '').toLowerCase();
}

function useAppHealth(productId: string | undefined, params: QueryParams, enabled: boolean) {
  const kpi = useScopedKpi(params, productId, enabled);
  const mix = useScopedDashboardMetric('user-mix', params, productId, enabled);
  const scan = useScopedDashboardMetric('mvp-time-to-first-scan', params, productId, enabled);
  const identify = useScopedFunnel('identify', params, productId, enabled);
  const paywall = useScopedFunnel('paywall', params, productId, enabled);
  const expert = useScopedFunnel('expert', params, productId, enabled && productId === 'coinzy');
  return { kpi, mix, scan, identify, paywall, expert };
}

function picksForApp(
  name: string,
  mix: ReturnType<typeof mixTotals>,
  kpi: { d1?: number; d7?: number } | undefined,
  scan: ReturnType<typeof rollupScan>,
  identifyRows: FunnelRow[] | undefined,
  expertRows: FunnelRow[] | undefined,
  summary: SummaryRow | undefined,
): PickItem[] {
  const out: PickItem[] = [];
  const leak = biggestLeak(identifyRows);

  if (scan.rate != null && scan.rate < 0.05) {
    out.push({
      pri: 1,
      title: `Fix same-day first scan (${fmtRate(scan.rate)})`,
      detail: `${name}: ${fmtCount(scan.scanned)} of ${fmtCount(scan.cohort)} installs got a successful ID the same day. Fix install → camera → two photos → success before ads or collection.`,
    });
  } else if (scan.rate != null && scan.rate < 0.15) {
    out.push({
      pri: 2,
      title: `Raise day-0 scan (${fmtRate(scan.rate)})`,
      detail: `${name}: only ${fmtCount(scan.scanned)} of ${fmtCount(scan.cohort)} installs reach an ID on day 0. Typical time ${fmtDuration(scan.medianSec)}.`,
    });
  }

  if (mix.unique > 0 && mix.oneDayShare >= 0.7) {
    out.push({
      pri: 2,
      title: `Most people try once (${fmtRate(mix.oneDayShare)})`,
      detail: `${name}: ${fmtCount(mix.oneDay)} of ${fmtCount(mix.unique)} unique people used the app on only one day. Raise day-0 scan and D1 (${fmtRate(kpi?.d1)}).`,
    });
  }

  if (leak && leak.dropped >= 20) {
    out.push({
      pri: 3,
      title: `Identify leak: ${leak.from} → ${leak.to}`,
      detail: `${name}: ${fmtCount(leak.dropped)} people drop here (${fmtCount(leak.fromUsers)} → ${fmtCount(leak.toUsers)}). That is the first place to fix in the scan path.`,
    });
  }

  const quality = Number(summary?.identification_success_rate);
  if (Number.isFinite(quality) && quality > 0 && quality < 0.7) {
    out.push({
      pri: 4,
      title: `Scan quality is ${fmtRate(quality)}`,
      detail: `${name}: finished scans succeed less often than they should. Photo guidance and model quality.`,
    });
  }

  if (expertRows?.length) {
    const landing = stepUsers(expertRows, 'landing');
    const report = stepUsers(expertRows, 'report');
    if (landing >= 30 && (landing === 0 || report / landing < 0.08)) {
      out.push({
        pri: 3,
        title: `Expert almost never reaches a report`,
        detail: `${name}: landing ${fmtCount(landing)} → report ${fmtCount(report)}. Fix pay / credit continue before promoting the feature.`,
      });
    }
  }

  if (n(kpi?.d7) > 0 && n(kpi?.d7) < 0.05) {
    out.push({
      pri: 5,
      title: `D7 is ${fmtRate(kpi?.d7)}`,
      detail: `${name}: after aha works, give a reason to open again (collection reminder, second scan).`,
    });
  }

  const paywallRate = Number(summary?.paywall_to_confirm_rate);
  if (Number.isFinite(paywallRate) && paywallRate > 0 && paywallRate < 0.08) {
    out.push({
      pri: 6,
      title: `Paywall conversion ${fmtRate(paywallRate)}`,
      detail: `${name}: show the paywall after a successful ID, not before people have seen value.`,
    });
  }

  if (!out.length) {
    out.push({
      pri: 9,
      title: 'No blocking leak in this range',
      detail: `${name}: keep watching one-day users, day-0 scan, and Identify drop-offs.`,
    });
  }

  return out.sort((a, b) => a.pri - b.pri);
}

export default function ReportPage({ params, setParams, applyFilters }: Props) {
  const { product, productId, isCompare, products, canCompare } = useProduct();
  const { chart } = useTheme();
  const canCombined = canCompare || products.length >= 2;

  const defaultView = isCompare && canCombined
    ? 'combined'
    : products.some((p) => p.id === productId)
      ? productId
      : products[0]?.id || 'combined';

  const [view, setView] = useState(defaultView);
  const sidebarProduct = isCompare ? 'compare' : productId;

  useEffect(() => {
    if (sidebarProduct === 'compare' && canCombined) setView('combined');
    else if (products.some((p) => p.id === sidebarProduct)) setView(sidebarProduct);
    // Only follow the sidebar switcher — page tabs stay independent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarProduct]);

  const a = products[0];
  const b = products[1];
  const needA = Boolean(a) && (view === 'combined' || view === a.id);
  const needB = Boolean(b) && (view === 'combined' || view === b.id);

  const healthA = useAppHealth(a?.id, params, needA);
  const healthB = useAppHealth(b?.id, params, needB);
  const summaryQ = useDashboardMetric('compare-summary', params, canCombined);
  const dailyQ = useDashboardMetric('compare-daily', params, view === 'combined' && canCombined);

  const summaries = (summaryQ.data || []) as SummaryRow[];
  const daily = (dailyQ.data || []) as DailyRow[];

  const healthById: Record<string, ReturnType<typeof useAppHealth>> = {};
  if (a) healthById[a.id] = healthA;
  if (b) healthById[b.id] = healthB;

  const tipStyle = useMemo(
    () => ({
      background: chart.tooltipBg,
      border: `1px solid ${chart.tooltipBorder}`,
      color: 'var(--text)',
    }),
    [chart],
  );

  const rangeLabel = [params.start_date, params.end_date].filter(Boolean).join(' → ') || 'selected range';

  const combinedTable = useMemo(() => {
    if (view !== 'combined') return [];
    return products.map((p) => {
      const h = healthById[p.id];
      const mix = mixTotals(h?.mix.data as MixRow[] | undefined);
      const scan = rollupScan(h?.scan.data as ScanRow[] | undefined);
      const summary = summaries.find((r) => matchProduct(r.product, p.shortName));
      const kpi = h?.kpi.data;
      const leak = biggestLeak(h?.identify.data?.rows);
      return { product: p, mix, scan, summary, kpi, leak };
    });
  }, [view, products, summaries, healthA.mix.data, healthA.scan.data, healthA.kpi.data, healthA.identify.data, healthB.mix.data, healthB.scan.data, healthB.kpi.data, healthB.identify.data]);

  const dauSeries = useMemo(() => {
    const labels = products.map((p) => p.shortName);
    const byDate = new Map<string, Record<string, unknown>>();
    for (const r of daily) {
      const date = String(r.event_date || '').slice(0, 10);
      const cur = byDate.get(date) || { event_date: date, day: date.slice(5) };
      const label = labels.find((l) => matchProduct(r.product, l));
      if (label) cur[label] = n(r.dau);
      byDate.set(date, cur);
    }
    return Array.from(byDate.values()).sort((x, y) =>
      String(x.event_date).localeCompare(String(y.event_date)),
    );
  }, [daily, products]);

  const identifyChart = useMemo(() => {
    if (view !== 'combined' || products.length < 2) return [];
    const stepsA = coreSteps(healthA.identify.data?.rows);
    const stepsB = coreSteps(healthB.identify.data?.rows);
    const ids = [...new Set([...stepsA, ...stepsB].map((s) => String(s.step_id || '')))].filter(Boolean);
    return ids.map((id) => {
      const aStep = stepsA.find((s) => s.step_id === id);
      const bStep = stepsB.find((s) => s.step_id === id);
      return {
        step: String(aStep?.step_label || bStep?.step_label || id),
        [products[0].shortName]: n(aStep?.users),
        [products[1].shortName]: n(bStep?.users),
      };
    });
  }, [view, products, healthA.identify.data, healthB.identify.data]);

  const combinedPicks = useMemo(() => {
    const items: PickItem[] = [];
    for (const row of combinedTable) {
      items.push(
        ...picksForApp(
          row.product.shortName,
          row.mix,
          row.kpi,
          row.scan,
          healthById[row.product.id]?.identify.data?.rows,
          healthById[row.product.id]?.expert.data?.rows,
          row.summary,
        ).slice(0, 3),
      );
    }
    return items.sort((x, y) => x.pri - y.pri).slice(0, 8);
  }, [combinedTable, healthA.identify.data, healthA.expert.data, healthB.identify.data, healthB.expert.data]);

  const combinedLoading =
    view === 'combined'
    && (summaryQ.isLoading || dailyQ.isLoading || (needA && healthA.mix.isLoading) || (needB && healthB.mix.isLoading));

  const activeProduct = products.find((p) => p.id === view);
  const activeHealth = activeProduct ? healthById[activeProduct.id] : undefined;

  return (
    <>
      <div className="page-header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ClipboardList size={22} />
            Health report
          </h2>
          <p>
            Live numbers for {rangeLabel}. Combined compares both apps; Banknote and Coinzy
            are each app on its own. DAU is people who opened the app — not notification-only.
          </p>
        </div>
        <FilterBar params={params} onChange={setParams} onApply={applyFilters} />
      </div>

      <div className="page-content">
        <div className="admin-tabs" role="tablist" aria-label="Report view">
          {canCombined && (
            <button
              type="button"
              className={view === 'combined' ? 'active' : ''}
              onClick={() => setView('combined')}
            >
              Combined
            </button>
          )}
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              className={view === p.id ? 'active' : ''}
              onClick={() => setView(p.id)}
            >
              {p.shortName}
            </button>
          ))}
        </div>

        {view === 'combined' && canCombined && (
          <>
            <div className="page-hint funnel-guide">
              <p>
                <strong>Combined</strong> answers: which app is healthier, and what to fix first on each.
                Sidebar Compare stays charts-only; this page is the written report.
              </p>
            </div>

            {combinedLoading && <div className="empty-state">Loading combined report…</div>}

            {!combinedLoading && (
              <>
                <div className="kpi-row">
                  {combinedTable.map((row) => (
                    <div key={row.product.id} className="kpi-card">
                      <div className="label">{row.product.shortName} unique people</div>
                      <div className="value">{fmtCount(row.mix.unique)}</div>
                    </div>
                  ))}
                  {combinedTable.map((row) => (
                    <div key={`${row.product.id}-dau`} className="kpi-card">
                      <div className="label">{row.product.shortName} latest DAU</div>
                      <div className="value">{fmtCount(row.summary?.dau)}</div>
                    </div>
                  ))}
                </div>

                <div className="report-pick">
                  {combinedTable.map((row) => {
                    const items = picksForApp(
                      row.product.shortName,
                      row.mix,
                      row.kpi,
                      row.scan,
                      healthById[row.product.id]?.identify.data?.rows,
                      healthById[row.product.id]?.expert.data?.rows,
                      row.summary,
                    ).slice(0, 3);
                    return (
                      <div key={row.product.id} className="report-pick-card">
                        <h3>Pick this on {row.product.shortName}</h3>
                        <ol>
                          {items.map((item) => (
                            <li key={item.title}>
                              <strong>{item.title}.</strong> {item.detail}
                            </li>
                          ))}
                        </ol>
                      </div>
                    );
                  })}
                </div>

                <ChartCard title="Opened the app (DAU)" loading={dailyQ.isLoading} error={dailyQ.error?.message}>
                  <p className="funnel-note" style={{ marginTop: 0 }}>
                    Distinct people per day · session_start / App_open / first_open · not notifications
                  </p>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={dauSeries}>
                      <CartesianGrid stroke={chart.grid} vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: chart.tick, fontSize: 11 }} />
                      <YAxis tick={{ fill: chart.tick, fontSize: 11 }} />
                      <Tooltip contentStyle={tipStyle} />
                      <Legend />
                      {products.map((p) => (
                        <Line
                          key={p.id}
                          type="monotone"
                          dataKey={p.shortName}
                          stroke={p.color || '#4f8cff'}
                          dot={false}
                          strokeWidth={2}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Product health side by side">
                  <div className="compare-table-wrap">
                    <table className="compare-table">
                      <thead>
                        <tr>
                          <th>Metric</th>
                          {products.map((p) => (
                            <th key={p.id} style={{ color: p.color }}>{p.shortName}</th>
                          ))}
                          <th>Why it matters</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          {
                            label: 'Unique people in range',
                            why: 'Audience size',
                            cells: combinedTable.map((r) => fmtCount(r.mix.unique)),
                          },
                          {
                            label: 'New (first_open)',
                            why: 'Acquisition vs already-users',
                            cells: combinedTable.map((r) =>
                              `${fmtCount(r.mix.newUsers)} (${fmtRate(r.mix.unique ? r.mix.newUsers / r.mix.unique : 0)})`,
                            ),
                          },
                          {
                            label: 'One day only',
                            why: 'Tried once and left — main growth leak',
                            cells: combinedTable.map((r) =>
                              `${fmtCount(r.mix.oneDay)} (${fmtRate(r.mix.oneDayShare)})`,
                            ),
                          },
                          {
                            label: 'Came back 2+ days',
                            why: 'Stickiness',
                            cells: combinedTable.map((r) =>
                              `${fmtCount(r.mix.multiDay)} (${fmtRate(r.mix.multiShare)})`,
                            ),
                          },
                          {
                            label: 'Opens / person',
                            why: 'Depth among people who use it',
                            cells: combinedTable.map((r) =>
                              Number.isFinite(r.mix.opensPerUser) ? r.mix.opensPerUser.toFixed(2) : '—',
                            ),
                          },
                          {
                            label: 'Latest opened-app DAU',
                            why: 'True usage that day',
                            cells: combinedTable.map((r) => fmtCount(r.summary?.dau)),
                          },
                          {
                            label: 'Notification DAU',
                            why: 'Push reach — not mixed into DAU',
                            cells: combinedTable.map((r) => fmtCount(r.summary?.notification_dau)),
                          },
                          {
                            label: 'D1 / D7',
                            why: 'Come-back after install',
                            cells: combinedTable.map((r) => `${fmtRate(r.kpi?.d1)} / ${fmtRate(r.kpi?.d7)}`),
                          },
                          {
                            label: 'Same-day first ID',
                            why: 'Aha on day 0',
                            cells: combinedTable.map((r) =>
                              `${fmtCount(r.scan.scanned)} / ${fmtCount(r.scan.cohort)} (${fmtRate(r.scan.rate)})`,
                            ),
                          },
                          {
                            label: 'Typical time to first ID',
                            why: 'In-session vs bounce',
                            cells: combinedTable.map((r) => fmtDuration(r.scan.medianSec)),
                          },
                          {
                            label: 'Identify success quality',
                            why: 'AI + photo quality',
                            cells: combinedTable.map((r) => fmtRate(r.summary?.identification_success_rate)),
                          },
                          {
                            label: 'Open → successful ID',
                            why: 'People who start Identify',
                            cells: combinedTable.map((r) => fmtRate(r.summary?.open_to_success_rate)),
                          },
                          {
                            label: 'Quota hit (of scanners)',
                            why: 'Free-limit pressure',
                            cells: combinedTable.map((r) => fmtRate(r.summary?.free_quota_hit_rate)),
                          },
                          {
                            label: 'Paywall → purchase',
                            why: 'Monetization conversion',
                            cells: combinedTable.map((r) => fmtRate(r.summary?.paywall_to_confirm_rate)),
                          },
                          {
                            label: 'Scans / DAU',
                            why: 'Scanner depth',
                            cells: combinedTable.map((r) => {
                              const v = Number(r.summary?.scans_per_user_day);
                              return Number.isFinite(v) ? v.toFixed(2) : '—';
                            }),
                          },
                        ].map((row) => (
                          <tr key={row.label}>
                            <td>{row.label}</td>
                            {row.cells.map((cell, i) => (
                              <td key={products[i]?.id || i}>{cell}</td>
                            ))}
                            <td className="muted">{row.why}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ChartCard>

                <ChartCard
                  title="Identify funnel — unique people at each main step"
                  loading={healthA.identify.isLoading || healthB.identify.isLoading}
                >
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={identifyChart}>
                      <CartesianGrid stroke={chart.grid} vertical={false} />
                      <XAxis dataKey="step" tick={{ fill: chart.tick, fontSize: 11 }} interval={0} />
                      <YAxis tick={{ fill: chart.tick, fontSize: 11 }} />
                      <Tooltip contentStyle={tipStyle} />
                      <Legend />
                      {products.map((p) => (
                        <Bar key={p.id} dataKey={p.shortName} fill={p.color || '#4f8cff'} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="What to pick so it works">
                  <ol className="report-actions">
                    {combinedPicks.map((item) => (
                      <li key={item.title}>
                        <strong>{item.title}.</strong> {item.detail}
                      </li>
                    ))}
                  </ol>
                  <p className="funnel-note">
                    Open <NavLink to="/compare">Compare Apps</NavLink> for charts, or switch to a
                    Banknote / Coinzy tab above for the separate report.
                  </p>
                </ChartCard>
              </>
            )}
          </>
        )}

        {activeProduct && activeHealth && (
          <SeparateReport
            name={activeProduct.shortName}
            color={activeProduct.color}
            health={activeHealth}
            summary={summaries.find((r) => matchProduct(r.product, activeProduct.shortName))}
            tipStyle={tipStyle}
            chart={chart}
          />
        )}

        {view !== 'combined' && !activeProduct && (
          <div className="empty-state">
            Select <strong>{product.shortName}</strong> or Combined to open a report.
          </div>
        )}
      </div>
    </>
  );
}

function SeparateReport({
  name,
  color,
  health,
  summary,
  tipStyle,
  chart,
}: {
  name: string;
  color?: string;
  health: ReturnType<typeof useAppHealth>;
  summary: SummaryRow | undefined;
  tipStyle: Record<string, string>;
  chart: { grid: string; tick: string };
}) {
  const mix = mixTotals(health.mix.data as MixRow[] | undefined);
  const scan = rollupScan(health.scan.data as ScanRow[] | undefined);
  const kpi = health.kpi.data;
  const identify = health.identify.data?.rows;
  const paywall = health.paywall.data?.rows;
  const expert = health.expert.data?.rows;
  const leak = biggestLeak(identify);
  const picks = picksForApp(name, mix, kpi, scan, identify, expert, summary);
  const core = coreSteps(identify);
  const loading = health.kpi.isLoading || health.mix.isLoading || health.scan.isLoading;

  const paywallStart = stepUsers(paywall, 'paywall');
  const paywallConfirm = stepUsers(paywall, 'confirm');

  if (loading) return <div className="empty-state">Loading {name} report…</div>;
  if (health.mix.error) {
    return <div className="empty-state error">{health.mix.error.message}</div>;
  }

  return (
    <>
      <div className="page-hint funnel-guide">
        <p>
          <strong>{name} — separate.</strong> Same formulas as the rest of the dashboard,
          rolled up for this date range.
        </p>
      </div>

      <div className="kpi-row">
        <div className="kpi-card">
          <div className="label">Unique people</div>
          <div className="value">{fmtCount(mix.unique)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Latest DAU</div>
          <div className="value">{fmtCount(summary?.dau ?? kpi?.dau)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">One day only</div>
          <div className="value">{fmtRate(mix.oneDayShare)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Same-day first ID</div>
          <div className="value">{fmtRate(scan.rate)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">D1 / D7</div>
          <div className="value" style={{ fontSize: 22 }}>{fmtRate(kpi?.d1)} / {fmtRate(kpi?.d7)}</div>
        </div>
        <div className="kpi-card">
          <div className="label">ID quality</div>
          <div className="value">{fmtRate(summary?.identification_success_rate)}</div>
        </div>
      </div>

      <div className="report-pick">
        <div className="report-pick-card">
          <h3>Do this on {name}</h3>
          <ol>
            {picks.slice(0, 4).map((item) => (
              <li key={item.title}>
                <strong>{item.title}.</strong> {item.detail}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <ChartCard title="Who used the app">
        <div className="compare-table-wrap">
          <table className="compare-table">
            <tbody>
              <tr><td>Unique people</td><td>{fmtCount(mix.unique)}</td></tr>
              <tr><td>New (first_open)</td><td>{fmtCount(mix.newUsers)}</td></tr>
              <tr><td>Returning</td><td>{fmtCount(mix.returning)}</td></tr>
              <tr><td>One day only</td><td>{fmtCount(mix.oneDay)} ({fmtRate(mix.oneDayShare)})</td></tr>
              <tr><td>Came back 2+ days</td><td>{fmtCount(mix.multiDay)} ({fmtRate(mix.multiShare)})</td></tr>
              <tr><td>Opens / person</td><td>{mix.opensPerUser.toFixed(2)}</td></tr>
            </tbody>
          </table>
        </div>
        <p className="funnel-note">
          Full daily split: <NavLink to="/user-mix">Unique vs repeat</NavLink>.
        </p>
      </ChartCard>

      <ChartCard title="Identify — where people leave" loading={health.identify.isLoading} error={health.identify.error?.message}>
        {leak && (
          <p className="funnel-note" style={{ marginTop: 0 }}>
            Biggest leak: <strong>{leak.from} → {leak.to}</strong> ({fmtCount(leak.dropped)} people).
          </p>
        )}
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={core.map((r) => ({ step: r.step_label, users: n(r.users) }))}>
            <CartesianGrid stroke={chart.grid} vertical={false} />
            <XAxis dataKey="step" tick={{ fill: chart.tick, fontSize: 11 }} interval={0} />
            <YAxis tick={{ fill: chart.tick, fontSize: 11 }} />
            <Tooltip contentStyle={tipStyle} />
            <Bar dataKey="users" name="People" fill={color || '#4f8cff'} />
          </BarChart>
        </ResponsiveContainer>
        <div className="compare-table-wrap" style={{ marginTop: 12 }}>
          <table className="compare-table">
            <thead>
              <tr>
                <th>Step</th>
                <th>People</th>
                <th>From previous</th>
              </tr>
            </thead>
            <tbody>
              {core.map((r, i) => {
                const prev = i === 0 ? null : n(core[i - 1].users);
                const users = n(r.users);
                const pctPrev = prev && prev > 0 ? users / prev : null;
                return (
                  <tr key={String(r.step_id)}>
                    <td>{r.step_label}</td>
                    <td>{fmtCount(users)}</td>
                    <td>{pctPrev == null ? '—' : fmtRate(pctPrev)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="funnel-note">
          Full path: <NavLink to="/funnels/identify">Identify funnel</NavLink>
          {' · '}
          <NavLink to="/mvp/time-to-first-scan">Install → first scan</NavLink>.
        </p>
      </ChartCard>

      <ChartCard title="Aha, paywall, habit">
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Surface</th>
                <th>Started</th>
                <th>Finished</th>
                <th>Convert</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Same-day first ID</td>
                <td>{fmtCount(scan.cohort)} installs</td>
                <td>{fmtCount(scan.scanned)}</td>
                <td>{fmtRate(scan.rate)}</td>
              </tr>
              <tr>
                <td>Paywall → confirm</td>
                <td>{fmtCount(paywallStart)}</td>
                <td>{fmtCount(paywallConfirm)}</td>
                <td>{paywallStart > 0 ? fmtRate(paywallConfirm / paywallStart) : '—'}</td>
              </tr>
              {name.toLowerCase() === 'coinzy' && expert && (
                <tr>
                  <td>Expert landing → report</td>
                  <td>{fmtCount(stepUsers(expert, 'landing'))}</td>
                  <td>{fmtCount(stepUsers(expert, 'report'))}</td>
                  <td>
                    {stepUsers(expert, 'landing') > 0
                      ? fmtRate(stepUsers(expert, 'report') / stepUsers(expert, 'landing'))
                      : '—'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="funnel-note">
          Typical time to first ID: <strong>{fmtDuration(scan.medianSec)}</strong>
          {' · '}
          <NavLink to="/funnels/paywall">Paywall funnel</NavLink>
          {name.toLowerCase() === 'coinzy' ? (
            <>
              {' · '}
              <NavLink to="/funnels/expert">Expert evaluation</NavLink>
            </>
          ) : null}
        </p>
      </ChartCard>
    </>
  );
}
