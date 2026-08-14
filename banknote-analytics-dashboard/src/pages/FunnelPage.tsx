import { useMemo, type CSSProperties } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import FilterBar from '@/components/FilterBar';
import ChartCard from '@/components/ChartCard';
import { useFunnel } from '@/hooks/useAnalytics';
import { fmtNumber, fmtPercent, QueryParams, FunnelRow } from '@/lib/api';
import { useProduct } from '@/lib/product';
import { useTheme } from '@/lib/theme';

interface Props {
  funnelId: 'identify' | 'catalogue' | 'marketplace' | 'paywall';
  params: QueryParams;
  setParams: (p: QueryParams) => void;
  applyFilters: () => void;
}

const PATH_STARTS: Record<Props['funnelId'], string[]> = {
  identify: [],
  catalogue: ['global_cta', 'global_screen', 'open_kpi'],
  marketplace: ['feed_tab', 'feed_screen'],
  paywall: [],
};

const PATH_TITLES: Record<string, string> = {
  collection_tab: 'Private collection',
  collection_screen: 'Private collection',
  global_cta: 'Global catalogue',
  global_screen: 'Global catalogue',
  open_kpi: 'KPI union',
  market_tab: 'Marketplace',
  market_screen: 'Marketplace',
  feed_tab: 'Feed',
  feed_screen: 'Feed',
  entry: 'Identify',
  paywall: 'Paywall',
  pack: 'Paywall',
};

function isTrue(v: unknown) {
  return v === true || v === 'true';
}

function pct(n: unknown) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return fmtPercent(Number(n));
}

function num(n: unknown) {
  return Number(n || 0);
}

function shortLabel(label: string, max = 22) {
  const s = String(label || '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

type FlowHop = {
  from: FunnelRow;
  to: FunnelRow;
  fromUsers: number;
  toUsers: number;
  convertRate: number | null;
  dropped: number;
  dropRate: number | null;
  gained: number;
};

type FlowSegment = {
  title: string;
  steps: FunnelRow[];
  hops: FlowHop[];
};

function buildFlowSegments(rows: FunnelRow[], funnelId: Props['funnelId']): FlowSegment[] {
  const pathStarts = new Set(PATH_STARTS[funnelId] || []);
  const core = rows.filter((r) => isTrue(r.is_core) && !isTrue(r.is_drop));
  const segments: FunnelRow[][] = [];
  let current: FunnelRow[] = [];

  for (const step of core) {
    const id = String(step.step_id || '');
    if (current.length && pathStarts.has(id)) {
      segments.push(current);
      current = [step];
    } else {
      current.push(step);
    }
  }
  if (current.length) segments.push(current);

  return segments.map((steps) => {
    const firstId = String(steps[0]?.step_id || '');
    const hops: FlowHop[] = [];
    for (let i = 1; i < steps.length; i++) {
      const from = steps[i - 1];
      const to = steps[i];
      const fromUsers = num(from.users);
      const toUsers = num(to.users);
      const dropped = Math.max(0, fromUsers - toUsers);
      const gained = Math.max(0, toUsers - fromUsers);
      hops.push({
        from,
        to,
        fromUsers,
        toUsers,
        convertRate: fromUsers > 0 ? toUsers / fromUsers : null,
        dropped,
        dropRate: fromUsers > 0 ? dropped / fromUsers : null,
        gained,
      });
    }
    return {
      title: PATH_TITLES[firstId] || String(steps[0]?.step_label || 'Path'),
      steps,
      hops,
    };
  });
}

function FunnelBars({ rows }: { rows: FunnelRow[] }) {
  const maxUsers = Math.max(1, ...rows.map((r) => num(r.users)));
  return (
    <div className="funnel-bars">
      {rows.map((r) => {
        const users = num(r.users);
        const w = Math.max(3, Math.round((users / maxUsers) * 100));
        const drop = isTrue(r.is_drop);
        const core = isTrue(r.is_core);
        return (
          <div
            key={String(r.step_id)}
            className={`funnel-bar-row${drop ? ' drop' : ''}${core ? ' core' : ''}`}
          >
            <div className="funnel-bar-label" title={String(r.event_names || '')}>
              {String(r.step_label)}
            </div>
            <div className="funnel-bar-track">
              <div className="funnel-bar-fill" style={{ width: `${w}%` }} />
            </div>
            <div className="funnel-bar-val">{fmtNumber(users)}</div>
            <div className="funnel-bar-conv">
              {core && r.pct_of_previous != null ? pct(r.pct_of_previous) : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PathBarChart({
  steps,
  tipStyle,
  tick,
  grid,
}: {
  steps: FunnelRow[];
  tipStyle: CSSProperties;
  tick: string;
  grid: string;
}) {
  const data = steps.map((s) => ({
    step: shortLabel(String(s.step_label), 16),
    full: String(s.step_label),
    users: num(s.users),
  }));
  const height = Math.max(260, 80 + data.length * 8);

  return (
    <div className="funnel-recharts path-bars" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 12, left: 4, bottom: 48 }}>
          <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="step"
            interval={0}
            angle={-28}
            textAnchor="end"
            height={56}
            tick={{ fill: tick, fontSize: 11 }}
          />
          <YAxis tick={{ fill: tick, fontSize: 11 }} width={44} />
          <Tooltip
            contentStyle={tipStyle}
            formatter={(value: number, _n, item) => [
              `${fmtNumber(value)} users`,
              item?.payload?.full || 'Users',
            ]}
          />
          <Bar dataKey="users" name="Unique users" fill="#4f8cff" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((d) => (
              <Cell key={d.step} fill="#4f8cff" />
            ))}
            <LabelList
              dataKey="users"
              position="top"
              fill={tick}
              fontSize={11}
              formatter={(v) => fmtNumber(Number(v))}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function HopDropChart({
  hops,
  tipStyle,
  tick,
  grid,
}: {
  hops: FlowHop[];
  tipStyle: CSSProperties;
  tick: string;
  grid: string;
}) {
  if (!hops.length) return null;
  const data = hops.map((h) => ({
    hop: shortLabel(`${String(h.from.step_label)} → ${String(h.to.step_label)}`, 28),
    full: `${String(h.from.step_label)} → ${String(h.to.step_label)}`,
    dropped: h.gained > 0 ? 0 : h.dropped,
    convert: h.convertRate == null ? 0 : Math.round(h.convertRate * 1000) / 10,
  }));

  return (
    <div className="funnel-recharts hop-bars" style={{ height: Math.max(220, 70 + data.length * 36) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 28, left: 8, bottom: 8 }}>
          <CartesianGrid stroke={grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fill: tick, fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="hop"
            width={168}
            tick={{ fill: tick, fontSize: 11 }}
          />
          <Tooltip
            contentStyle={tipStyle}
            formatter={(value: number, name: string, item) => [
              name === 'dropped' ? `${fmtNumber(value)} users` : `${value}%`,
              item?.payload?.full || name,
            ]}
          />
          <Bar dataKey="dropped" name="Dropped users" fill="#f87171" radius={[0, 4, 4, 0]} maxBarSize={18}>
            <LabelList dataKey="dropped" position="right" fill={tick} fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function FlowTable({ hops }: { hops: FlowHop[] }) {
  return (
    <div className="table-wrap funnel-table funnel-flow-table">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>From → To</th>
            <th>From</th>
            <th>To</th>
            <th>Convert</th>
            <th>Dropped</th>
            <th>Drop %</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {hops.length === 0 && (
            <tr>
              <td colSpan={8} className="muted">
                Need at least two core steps in this path.
              </td>
            </tr>
          )}
          {hops.map((f, i) => {
            const over = f.gained > 0;
            return (
              <tr key={`${f.from.step_id}-${f.to.step_id}`} className={over ? 'row-gain' : ''}>
                <td>{i + 1}</td>
                <td>
                  <span className="flow-from">{String(f.from.step_label)}</span>
                  <span className="flow-arrow"> → </span>
                  <span className="flow-to">{String(f.to.step_label)}</span>
                </td>
                <td>{fmtNumber(f.fromUsers)}</td>
                <td>{fmtNumber(f.toUsers)}</td>
                <td className={over ? 'pct-over' : ''}>{pct(f.convertRate)}</td>
                <td>{over ? '—' : fmtNumber(f.dropped)}</td>
                <td className={f.dropped > 0 && !over ? 'pct-drop' : ''}>
                  {over ? '—' : pct(f.dropRate)}
                </td>
                <td className="muted">
                  {over
                    ? `+${fmtNumber(f.gained)} joined without prior step`
                    : f.dropped > 0
                      ? `${fmtNumber(f.dropped)} left this hop`
                      : 'No drop'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function FunnelPage({ funnelId, params, setParams, applyFilters }: Props) {
  const { product, isCompare } = useProduct();
  const { chart } = useTheme();
  const q = useFunnel(funnelId, params, !isCompare);
  const data = q.data;
  const rows = data?.rows || [];
  const segments = buildFlowSegments(rows, funnelId);

  const tipStyle = useMemo(
    () => ({
      background: chart.tooltipBg,
      border: `1px solid ${chart.tooltipBorder}`,
      color: 'var(--text)',
    }),
    [chart],
  );

  const headline = useMemo(() => {
    const first = segments[0];
    if (!first?.steps.length) return null;
    const entry = num(first.steps[0].users);
    const last = num(first.steps[first.steps.length - 1].users);
    const worst = [...first.hops]
      .filter((h) => h.gained === 0)
      .sort((a, b) => b.dropped - a.dropped)[0];
    return {
      entry,
      last,
      convert: entry > 0 ? last / entry : null,
      worst,
    };
  }, [segments]);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>{data?.title || 'Funnel'}</h2>
          <p>
            {data?.description || 'Step-level unique users'} · {product.shortName}
            {data?.source ? ` · source: ${data.source}` : ''}
          </p>
        </div>
        <FilterBar params={params} onChange={setParams} onApply={applyFilters} />
      </div>

      <div className="page-content">
        {isCompare && (
          <div className="empty-state">
            Select <strong>Banknote</strong> or <strong>Coinzy</strong> (not Compare) to inspect funnels.
          </div>
        )}

        {!isCompare && data?.status === 'insufficient_instrumentation' && (
          <div className="empty-state warn">
            Insufficient instrumentation — {data.message || 'no verified event mapping'}
          </div>
        )}

        {!isCompare && q.isLoading && <div className="empty-state">Loading funnel…</div>}
        {!isCompare && q.error && (
          <div className="empty-state error">{q.error.message}</div>
        )}

        {!isCompare && data?.status === 'ok' && (
          <>
            {headline && (
              <div className="funnel-kpis">
                <div className="funnel-kpi">
                  <span className="funnel-kpi-label">Entry users</span>
                  <span className="funnel-kpi-value">{fmtNumber(headline.entry)}</span>
                </div>
                <div className="funnel-kpi">
                  <span className="funnel-kpi-label">End of core path</span>
                  <span className="funnel-kpi-value">{fmtNumber(headline.last)}</span>
                </div>
                <div className="funnel-kpi">
                  <span className="funnel-kpi-label">Core convert</span>
                  <span className="funnel-kpi-value">{pct(headline.convert)}</span>
                </div>
                <div className="funnel-kpi">
                  <span className="funnel-kpi-label">Largest drop</span>
                  <span className="funnel-kpi-value">
                    {headline.worst
                      ? `${fmtNumber(headline.worst.dropped)} (${pct(headline.worst.dropRate)})`
                      : '—'}
                  </span>
                  {headline.worst && (
                    <span className="funnel-kpi-sub">
                      {String(headline.worst.from.step_label)} → {String(headline.worst.to.step_label)}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="chart-grid">
              <ChartCard title="All steps — unique users" className="half">
                <p className="funnel-note" style={{ marginTop: 0 }}>
                  Width = unique users. Last column is conversion from the previous <strong>core</strong> step.
                </p>
                <FunnelBars rows={rows} />
              </ChartCard>

              {segments[0] && (
                <ChartCard title={`${segments[0].title} — users by step`} className="half">
                  <p className="funnel-note" style={{ marginTop: 0 }}>
                    Core path only. Each bar is unique users at that step.
                  </p>
                  <PathBarChart
                    steps={segments[0].steps}
                    tipStyle={tipStyle}
                    tick={chart.tick}
                    grid={chart.grid}
                  />
                </ChartCard>
              )}
            </div>

            {segments.map((seg) => (
              <ChartCard key={seg.title} title={`${seg.title} flow`}>
                <div className="core-path-strip">
                  {seg.steps.map((r, i) => (
                    <span key={String(r.step_id)} className="core-path-chip">
                      {i > 0 && <span className="core-path-arrow">→</span>}
                      <span className="core-path-label">{String(r.step_label)}</span>
                      <span className="core-path-users">{fmtNumber(num(r.users))}</span>
                    </span>
                  ))}
                </div>

                <div className={`funnel-split${seg === segments[0] ? ' single' : ''}`}>
                  {seg !== segments[0] && (
                    <div className="funnel-split-pane">
                      <h4 className="flow-segment-title">Users by step</h4>
                      <PathBarChart
                        steps={seg.steps}
                        tipStyle={tipStyle}
                        tick={chart.tick}
                        grid={chart.grid}
                      />
                    </div>
                  )}
                  <div className="funnel-split-pane">
                    <h4 className="flow-segment-title">Drop-off by hop</h4>
                    <HopDropChart
                      hops={seg.hops}
                      tipStyle={tipStyle}
                      tick={chart.tick}
                      grid={chart.grid}
                    />
                  </div>
                </div>

                <FlowTable hops={seg.hops} />
              </ChartCard>
            ))}

            <ChartCard title="Full step detail">
              <p className="funnel-note" style={{ marginTop: 0 }}>
                All mapped steps including side / drop branches. % of previous applies to core steps only.
              </p>
              <div className="table-wrap funnel-table">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Step</th>
                      <th>Events</th>
                      <th>Users</th>
                      <th>Hits</th>
                      <th>% of previous</th>
                      <th>Drop-off users</th>
                      <th>Drop-off %</th>
                      <th>% of DAU</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const drop = isTrue(r.is_drop);
                      const core = isTrue(r.is_core);
                      return (
                        <tr
                          key={String(r.step_id)}
                          className={drop ? 'row-drop' : core ? 'row-core' : ''}
                        >
                          <td>{String(r.step_order)}</td>
                          <td>
                            {String(r.step_label)}
                            {core ? <span className="badge">core</span> : null}
                            {drop ? <span className="badge danger">drop</span> : null}
                          </td>
                          <td className="mono muted events-cell" title={String(r.event_names || '')}>
                            {String(r.event_names || '')}
                          </td>
                          <td>{fmtNumber(num(r.users))}</td>
                          <td>{fmtNumber(num(r.hits))}</td>
                          <td>{pct(r.pct_of_previous)}</td>
                          <td>{r.prev_users == null ? '—' : fmtNumber(num(r.drop_off_users))}</td>
                          <td className={num(r.drop_off_users) > 0 ? 'pct-drop' : ''}>
                            {r.prev_users == null ? '—' : pct(r.drop_off_rate)}
                          </td>
                          <td>{pct(r.pct_of_dau)}</td>
                        </tr>
                      );
                    })}
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
