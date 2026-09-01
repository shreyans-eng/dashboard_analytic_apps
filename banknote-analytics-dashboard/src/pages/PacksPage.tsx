import { useMemo } from 'react';
import {
  Area,
  Bar,
  ComposedChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Calendar, CircleDollarSign, Package, Users } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import ChartCard from '@/components/ChartCard';
import AppMark from '@/components/AppMark';
import { useCompareSubscriptions, useSubscriptionPacks } from '@/hooks/useAnalytics';
import { fmtNumber, fmtPercent, fmtUsd, QueryParams } from '@/lib/api';
import { useProduct } from '@/lib/product';
import { useTheme } from '@/lib/theme';
import {
  ALL_PACKS,
  YEARLY_ROLLUP,
  isRollupPack,
  n,
  packKind,
  yearlyListPrice,
  type PackKind,
  type PackRow,
} from '@/lib/packs';

interface Props {
  params: QueryParams;
  setParams: (p: QueryParams) => void;
  applyFilters: () => void;
}

const KIND_COLOR: Record<string, string> = {
  Yearly: 'var(--brand-banknote-gold)',
  Monthly: 'var(--accent)',
  Lifetime: '#a78bfa',
  Other: 'var(--text-muted)',
};

function pct(part: number, whole: number) {
  return whole > 0 ? part / whole : 0;
}

function PackTooltip({
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

function ShareMeter({ yearly, total }: { yearly: number; total: number }) {
  const share = pct(yearly, total);
  const other = Math.max(0, total - yearly);
  return (
    <div className="packs-share">
      <div className="packs-share-head">
        <span>Yearly vs other packs</span>
        <strong>{total > 0 ? fmtPercent(share) : '—'} yearly</strong>
      </div>
      <div className="packs-share-track" role="img" aria-label={total > 0 ? `${fmtPercent(share)} yearly` : 'No pack confirms'}>
        <i className="packs-share-yearly" style={{ width: `${total > 0 ? share * 100 : 0}%` }} />
        <i className="packs-share-other" style={{ width: `${total > 0 ? (1 - share) * 100 : 0}%` }} />
      </div>
      <div className="packs-share-legend">
        <span><i className="packs-dot yearly" /> Yearly {fmtNumber(yearly)}</span>
        <span><i className="packs-dot other" /> Other {fmtNumber(other)}</span>
      </div>
    </div>
  );
}

function RankedPacks({
  packs,
  total,
  listPrice,
  showApp,
  colorByLabel,
}: {
  packs: PackRow[];
  total: number;
  listPrice?: number | null;
  showApp?: boolean;
  colorByLabel?: Record<string, string>;
}) {
  const maxUsers = Math.max(...packs.map((p) => n(p.unique_users)), 1);
  if (packs.length === 0) {
    return <p className="muted small">No named packs in this range.</p>;
  }
  return (
    <ol className="packs-rank">
      {packs.map((p) => {
        const kind = packKind(p);
        const users = n(p.unique_users);
        const share = pct(users, total || maxUsers);
        const bar = pct(users, maxUsers);
        const price = listPrice ?? yearlyListPrice(String(p.product_id || ''));
        const est = kind === 'Yearly' && price != null ? users * price : null;
        return (
          <li key={`${p.product || ''}-${p.pack_name}`}>
            <div className="packs-rank-meta">
              <span className="packs-rank-name">
                {showApp && (
                  <em style={{ color: colorByLabel?.[String(p.product)] }}>{String(p.product || '')}</em>
                )}
                {String(p.pack_name || '(unnamed pack)')}
              </span>
              <span className={`pack-kind kind-${kind.toLowerCase()}`}>{kind}</span>
            </div>
            <div className="packs-rank-bar">
              <i style={{ width: `${bar * 100}%`, background: KIND_COLOR[kind] || KIND_COLOR.Other }} />
            </div>
            <div className="packs-rank-stats">
              <strong>{fmtNumber(users)}</strong>
              <span>{total > 0 ? fmtPercent(share) : '—'}</span>
              <span>{fmtNumber(n(p.takes))} confirms</span>
              {est != null && <span>{fmtUsd(est)}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

type PackSummary = {
  product: string;
  product_id?: string;
  unique_users?: number;
  takes?: number;
  yearly_users?: number;
  yearly_list_price?: number | null;
  yearly_revenue?: number | null;
};

const KIND_ORDER: PackKind[] = ['Yearly', 'Monthly', 'Lifetime', 'Other'];

export default function PacksPage({ params, setParams, applyFilters }: Props) {
  const { product, productId, isCompare, products } = useProduct();
  const { chart } = useTheme();
  const q = useSubscriptionPacks(params, !isCompare);
  const compareQ = useCompareSubscriptions(params, isCompare);
  const rows = (q.data?.rows || []) as PackRow[];
  const listPrice = q.data?.yearly_list_price ?? yearlyListPrice(productId);

  const rangePacks = useMemo(
    () =>
      rows
        .filter((r) => r.grain === 'range' && !isRollupPack(r.pack_name))
        .sort((a, b) => n(b.unique_users) - n(a.unique_users)),
    [rows],
  );

  const rangeAll = rows.find((r) => r.grain === 'range' && r.pack_name === ALL_PACKS);
  const rangeYearly = rows.find((r) => r.grain === 'range' && r.pack_name === YEARLY_ROLLUP);
  const uniqueUsers = n(rangeAll?.unique_users);
  const yearlyUsers = n(rangeYearly?.unique_users);
  const yearlyRevenue = listPrice == null ? null : yearlyUsers * listPrice;
  const yearlyShare = pct(yearlyUsers, uniqueUsers);

  const kindCounts = useMemo(() => {
    const map: Record<string, number> = { Yearly: 0, Monthly: 0, Lifetime: 0, Other: 0 };
    for (const p of rangePacks) {
      const kind = packKind(p);
      map[kind] = (map[kind] || 0) + n(p.unique_users);
    }
    return KIND_ORDER.filter((k) => map[k] > 0).map((k) => ({ kind: k, users: map[k] }));
  }, [rangePacks]);

  const daily = useMemo(
    () => {
      const byDate = new Map<string, { day: string; All: number; Yearly: number }>();
      for (const r of rows) {
        if (r.grain !== 'day') continue;
        const date = String(r.event_date || '').slice(0, 10);
        if (!date) continue;
        const cur = byDate.get(date) || { day: date.slice(5), All: 0, Yearly: 0 };
        if (r.pack_name === ALL_PACKS) cur.All = n(r.unique_users);
        if (r.pack_name === YEARLY_ROLLUP) cur.Yearly = n(r.unique_users);
        byDate.set(date, cur);
      }
      return Array.from(byDate.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, v]) => v);
    },
    [rows],
  );

  const showData = !isCompare && !q.isLoading && !q.error && rows.length > 0;

  const labels = useMemo(() => products.map((p) => p.shortName), [products]);
  const colorByLabel = useMemo(() => {
    const map: Record<string, string> = {};
    products.forEach((p) => {
      map[p.shortName] = p.color;
    });
    return map;
  }, [products]);
  const matchProduct = (rowProduct: string, label: string) =>
    String(rowProduct || '').toLowerCase() === String(label || '').toLowerCase();

  const compareRows = (compareQ.data?.rows ?? []) as PackRow[];
  const compareSummary = (compareQ.data?.summary ?? []) as PackSummary[];
  const compareDaily = useMemo(() => {
    const byDate = new Map<string, Record<string, unknown>>();
    for (const r of compareRows) {
      if (r.grain !== 'day' || r.pack_name !== ALL_PACKS) continue;
      const date = String(r.event_date || '').slice(0, 10);
      if (!date) continue;
      const label = labels.find((l) => matchProduct(String(r.product || ''), l));
      if (!label) continue;
      const cur = byDate.get(date) || { event_date: date };
      cur[label] = n(r.unique_users);
      byDate.set(date, cur);
    }
    return Array.from(byDate.values()).sort((a, b) =>
      String(a.event_date).localeCompare(String(b.event_date)),
    );
  }, [compareRows, labels]);
  const comparePacks = useMemo(
    () =>
      compareRows
        .filter((r) => r.grain === 'range' && !isRollupPack(r.pack_name))
        .sort((a, b) => n(b.unique_users) - n(a.unique_users)),
    [compareRows],
  );
  const compareTotal = comparePacks.reduce((s, p) => s + n(p.unique_users), 0);

  const tipStyle = {
    background: chart.tooltipBg,
    border: `1px solid ${chart.tooltipBorder}`,
    color: 'var(--text)',
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Package size={22} />
            Packs taken
          </h2>
          <p>
            {isCompare
              ? 'Unique people who confirmed a pack. Yearly estimate is list price — Banknote $20, Coinzy $15.'
              : `Unique people who confirmed a pack in ${product.shortName}. Yearly list price $${listPrice ?? '—'}.`}
          </p>
        </div>
        <FilterBar params={params} onChange={setParams} onApply={applyFilters} />
      </div>

      <div className="page-content packs-page">
        {isCompare && compareQ.isLoading && <div className="empty-state">Loading packs…</div>}
        {isCompare && compareQ.error && (
          <div className="empty-state error">{compareQ.error.message}</div>
        )}
        {isCompare && !compareQ.isLoading && !compareQ.error && (
          <div className="packs-flow">
            <div className="packs-compare-kpis">
              {products.map((p) => {
                const row = compareSummary.find((s) => matchProduct(s.product, p.shortName))
                  || compareSummary.find((s) => String(s.product_id) === p.id);
                const price = row?.yearly_list_price ?? yearlyListPrice(p.id);
                const unique = n(row?.unique_users);
                const yearly = n(row?.yearly_users);
                return (
                  <div key={p.id} className="packs-compare-card" data-app={p.id}>
                    <AppMark product={p.id} size={32} />
                    <div className="packs-compare-card-copy">
                      <strong style={{ color: p.color }}>{p.shortName}</strong>
                      <span>${price ?? '—'} yearly list price</span>
                    </div>
                    <dl>
                      <div>
                        <dt>Unique people</dt>
                        <dd>{fmtNumber(unique)}</dd>
                      </div>
                      <div>
                        <dt>Yearly</dt>
                        <dd>{fmtNumber(yearly)}</dd>
                      </div>
                      <div>
                        <dt>Est. yearly</dt>
                        <dd>{row?.yearly_revenue == null ? '—' : fmtUsd(row.yearly_revenue)}</dd>
                      </div>
                    </dl>
                    <ShareMeter yearly={yearly} total={unique} />
                  </div>
                );
              })}
            </div>

            <ChartCard title="Unique people per day">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={compareDaily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="event_date"
                    tick={{ fill: chart.tick, fontSize: 11 }}
                    tickFormatter={(v) => String(v).slice(5)}
                  />
                  <YAxis tick={{ fill: chart.tick, fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={tipStyle} />
                  <Legend />
                  {labels.map((l) => (
                    <Line
                      key={l}
                      type="monotone"
                      dataKey={l}
                      stroke={colorByLabel[l]}
                      strokeWidth={2.5}
                      dot={false}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <section className="packs-panel">
              <h3>Pack mix</h3>
              <RankedPacks
                packs={comparePacks}
                total={compareTotal}
                showApp
                colorByLabel={colorByLabel}
              />
            </section>
          </div>
        )}

        {!isCompare && q.isLoading && <div className="empty-state">Loading packs…</div>}
        {!isCompare && q.error && <div className="empty-state error">{q.error.message}</div>}
        {!isCompare && !q.isLoading && !q.error && rows.length === 0 && (
          <div className="empty-state">No pack confirms in this range.</div>
        )}

        {showData && (
          <div className="packs-flow">
            <div className="packs-story">
              <p>
                <strong>{fmtNumber(uniqueUsers)}</strong> people took a pack.
                {' '}
                <strong>{fmtNumber(yearlyUsers)}</strong> chose yearly
                {uniqueUsers > 0 ? ` (${fmtPercent(yearlyShare)})` : ''}.
                {yearlyRevenue != null && (
                  <> Estimated yearly <strong>{fmtUsd(yearlyRevenue)}</strong>.</>
                )}
              </p>
            </div>

            <div className="packs-kpis">
              <div className="kpi-card packs-kpi" data-tone="people">
                <div className="packs-kpi-icon"><Users size={16} /></div>
                <div className="label">Unique people</div>
                <div className="value">{fmtNumber(uniqueUsers)}</div>
                <div className="why">Took any pack in this range</div>
              </div>
              <div className="kpi-card packs-kpi" data-tone="yearly">
                <div className="packs-kpi-icon"><Calendar size={16} /></div>
                <div className="label">Yearly unique</div>
                <div className="value">{fmtNumber(yearlyUsers)}</div>
                <div className="why">{uniqueUsers > 0 ? fmtPercent(yearlyShare) : '—'} of people who bought</div>
              </div>
              <div className="kpi-card packs-kpi" data-tone="money">
                <div className="packs-kpi-icon"><CircleDollarSign size={16} /></div>
                <div className="label">Yearly estimated</div>
                <div className="value">{yearlyRevenue == null ? '—' : fmtUsd(yearlyRevenue)}</div>
                <div className="why">
                  {listPrice == null
                    ? 'No yearly list price for this app'
                    : `${fmtNumber(yearlyUsers)} × $${listPrice}`}
                </div>
              </div>
              <div className="kpi-card packs-kpi" data-tone="confirms">
                <div className="packs-kpi-icon"><Package size={16} /></div>
                <div className="label">Confirms</div>
                <div className="value">{fmtNumber(n(rangeAll?.takes))}</div>
                <div className="why">{rangePacks.length} named packs</div>
              </div>
            </div>

            <div className="packs-mix-row">
              <ShareMeter yearly={yearlyUsers} total={uniqueUsers} />
              {kindCounts.length > 0 && (
                <div className="packs-kinds">
                  <span>By kind</span>
                  <div className="packs-kind-pills">
                    {kindCounts.map((k) => (
                      <span key={k.kind} className={`pack-kind kind-${k.kind.toLowerCase()}`}>
                        {k.kind} · {fmtNumber(k.users)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="chart-grid">
              <ChartCard title="Unique people per day" className="half">
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="packsAllFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={product.color} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={product.color} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: chart.tick, fontSize: 11 }} />
                    <YAxis tick={{ fill: chart.tick, fontSize: 11 }} allowDecimals={false} />
                    <Tooltip content={<PackTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="All"
                      name="Any pack"
                      stroke={product.color}
                      fill="url(#packsAllFill)"
                      strokeWidth={2}
                    />
                    <Bar dataKey="Yearly" name="Yearly" fill="var(--brand-banknote-gold)" radius={[3, 3, 0, 0]} maxBarSize={18} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Which packs people took" className="half">
                <RankedPacks packs={rangePacks} total={uniqueUsers} listPrice={listPrice} />
              </ChartCard>
            </div>

            <div className="packs-table-wrap">
              <table className="packs-table">
                <thead>
                  <tr>
                    <th>Pack</th>
                    <th>Kind</th>
                    <th>Unique people</th>
                    <th>Share</th>
                    <th>Confirms</th>
                    <th>Est. yearly</th>
                  </tr>
                </thead>
                <tbody>
                  {rangePacks.map((p) => {
                    const kind = packKind(p);
                    const users = n(p.unique_users);
                    const share = pct(users, uniqueUsers);
                    const est = kind === 'Yearly' && listPrice != null ? users * listPrice : null;
                    return (
                      <tr key={String(p.pack_name)}>
                        <td>{String(p.pack_name || '(unnamed pack)')}</td>
                        <td>
                          <span className={`pack-kind kind-${kind.toLowerCase()}`}>{kind}</span>
                        </td>
                        <td>
                          <div className="packs-cell-bar">
                            <span className="packs-cell-track">
                              <i style={{ width: `${share * 100}%`, background: KIND_COLOR[kind] }} />
                            </span>
                            <span>{fmtNumber(users)}</span>
                          </div>
                        </td>
                        <td>{uniqueUsers > 0 ? fmtPercent(share) : '—'}</td>
                        <td>{fmtNumber(n(p.takes))}</td>
                        <td>{est == null ? '—' : fmtUsd(est)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="packs-cards">
              {rangePacks.map((p) => {
                const kind = packKind(p);
                const users = n(p.unique_users);
                const share = pct(users, uniqueUsers);
                const est = kind === 'Yearly' && listPrice != null ? users * listPrice : null;
                return (
                  <article key={String(p.pack_name)} className="packs-card">
                    <header>
                      <strong>{String(p.pack_name || '(unnamed pack)')}</strong>
                      <span className={`pack-kind kind-${kind.toLowerCase()}`}>{kind}</span>
                    </header>
                    <div className="packs-rank-bar">
                      <i style={{ width: `${share * 100}%`, background: KIND_COLOR[kind] }} />
                    </div>
                    <dl>
                      <div>
                        <dt>Unique people</dt>
                        <dd>{fmtNumber(users)}</dd>
                      </div>
                      <div>
                        <dt>Share</dt>
                        <dd>{uniqueUsers > 0 ? fmtPercent(share) : '—'}</dd>
                      </div>
                      <div>
                        <dt>Confirms</dt>
                        <dd>{fmtNumber(n(p.takes))}</dd>
                      </div>
                      <div>
                        <dt>Est. yearly</dt>
                        <dd>{est == null ? '—' : fmtUsd(est)}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
