import { useMemo } from 'react';
import {
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
import { Calendar, CalendarDays, CircleDollarSign, Gem, MousePointerClick, Package, Repeat, Users } from 'lucide-react';
import FilterBar from '@/components/FilterBar';
import ChartCard from '@/components/ChartCard';
import AppMark from '@/components/AppMark';
import { useCompareSubscriptions, useSubscriptionPacks } from '@/hooks/useAnalytics';
import { fmtNumber, fmtPercent, fmtUsd, fmtDecimal, QueryParams } from '@/lib/api';
import { useProduct } from '@/lib/product';
import { useTheme } from '@/lib/theme';
import {
  ALL_PACKS,
  CLICKS_ROLLUP,
  LIFETIME_ROLLUP,
  MONTHLY_ROLLUP,
  YEARLY_ROLLUP,
  isRollupPack,
  n,
  packEventHint,
  packDisplayName,
  packKind,
  splitPacksByKind,
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

function MixMeter({
  yearly,
  monthly,
  lifetime = 0,
  other = 0,
}: {
  yearly: number;
  monthly: number;
  lifetime?: number;
  other?: number;
}) {
  const rest = Math.max(0, other);
  const total = yearly + monthly + lifetime + rest;
  const yShare = pct(yearly, total);
  const mShare = pct(monthly, total);
  const lShare = pct(lifetime, total);
  const oShare = pct(rest, total);
  return (
    <div className="packs-share">
      <div className="packs-share-head">
        <span>Yearly · monthly · lifetime</span>
        <strong>
          {total > 0
            ? `${fmtPercent(yShare)} yearly · ${fmtPercent(mShare)} monthly · ${fmtPercent(lShare)} lifetime`
            : '—'}
        </strong>
      </div>
      <div
        className="packs-share-track"
        role="img"
        aria-label={total > 0 ? 'Yearly monthly lifetime mix' : 'No pack confirms'}
      >
        <i className="packs-share-yearly" style={{ width: `${total > 0 ? yShare * 100 : 0}%` }} />
        <i className="packs-share-monthly" style={{ width: `${total > 0 ? mShare * 100 : 0}%` }} />
        <i className="packs-share-lifetime" style={{ width: `${total > 0 ? lShare * 100 : 0}%` }} />
        {rest > 0 && <i className="packs-share-other" style={{ width: `${oShare * 100}%` }} />}
      </div>
      <div className="packs-share-legend">
        <span><i className="packs-dot yearly" /> Yearly {fmtNumber(yearly)}</span>
        <span><i className="packs-dot monthly" /> Monthly {fmtNumber(monthly)}</span>
        <span><i className="packs-dot lifetime" /> Lifetime {fmtNumber(lifetime)}</span>
        {rest > 0 && <span><i className="packs-dot other" /> Other {fmtNumber(rest)}</span>}
      </div>
    </div>
  );
}

function OfferMeter({
  full,
  half,
  trial,
}: {
  full: number;
  half: number;
  trial: number;
}) {
  const total = full + half + trial;
  if (total <= 0) return null;
  return (
    <div className="packs-share">
      <div className="packs-share-head">
        <span>Full vs half vs trial</span>
        <strong>
          {fmtPercent(pct(full, total))} full · {fmtPercent(pct(half, total))} half · {fmtPercent(pct(trial, total))} trial
        </strong>
      </div>
      <div className="packs-share-track">
        <i className="packs-share-yearly" style={{ width: `${pct(full, total) * 100}%` }} />
        <i className="packs-share-monthly" style={{ width: `${pct(half, total) * 100}%` }} />
        <i className="packs-share-lifetime" style={{ width: `${pct(trial, total) * 100}%` }} />
      </div>
      <div className="packs-share-legend">
        <span><i className="packs-dot yearly" /> Full {fmtNumber(full)}</span>
        <span><i className="packs-dot monthly" /> Half {fmtNumber(half)}</span>
        <span><i className="packs-dot lifetime" /> Trial {fmtNumber(trial)}</span>
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
  empty,
}: {
  packs: PackRow[];
  total: number;
  listPrice?: number | null;
  showApp?: boolean;
  colorByLabel?: Record<string, string>;
  empty?: string;
}) {
  const maxUsers = Math.max(...packs.map((p) => n(p.unique_users)), 1);
  if (packs.length === 0) {
    return <p className="muted small">{empty || 'No named packs in this range.'}</p>;
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
                {String(packDisplayName(p.pack_name))}
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
  monthly_users?: number;
  lifetime_users?: number;
  clickers?: number;
  click_to_confirm_rate?: number | null;
  retries_per_user?: number | null;
  full_users?: number;
  half_users?: number;
  trial_users?: number;
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
  const rangeMonthly = rows.find((r) => r.grain === 'range' && r.pack_name === MONTHLY_ROLLUP);
  const rangeLifetime = rows.find((r) => r.grain === 'range' && r.pack_name === LIFETIME_ROLLUP);
  const rangeClicks = rows.find((r) => r.grain === 'range' && r.pack_name === CLICKS_ROLLUP);
  const uniqueUsers = n(rangeAll?.unique_users);
  const yearlyUsers = n(rangeYearly?.unique_users);
  const monthlyUsers = n(rangeMonthly?.unique_users);
  const lifetimeUsers = n(rangeLifetime?.unique_users);
  const clickers = n(rangeClicks?.unique_users);
  const otherUsers = Math.max(0, uniqueUsers - yearlyUsers - monthlyUsers - lifetimeUsers);
  const clickRate = clickers > 0 ? uniqueUsers / clickers : null;
  const retries = uniqueUsers > 0 ? n(rangeAll?.takes) / uniqueUsers : null;
  const offerMix = rangePacks.reduce(
    (acc, p) => {
      const key = String(p.pack_name || '').toLowerCase();
      const bucket = key.includes('half') ? 'half' : key.includes('trial') ? 'trial' : 'full';
      if (packKind(p) === 'Other') return acc;
      acc[bucket] += n(p.unique_users);
      return acc;
    },
    { full: 0, half: 0, trial: 0 },
  );
  const fullUsers = offerMix.full;
  const halfUsers = offerMix.half;
  const trialUsers = offerMix.trial;
  const yearlyRevenue = listPrice == null ? null : yearlyUsers * listPrice;
  const yearlyShare = pct(yearlyUsers, uniqueUsers);
  const monthlyShare = pct(monthlyUsers, uniqueUsers);
  const lifetimeShare = pct(lifetimeUsers, uniqueUsers);
  const { yearly: yearlyPacks, monthly: monthlyPacks, lifetime: lifetimePacks, other: otherPacks } = splitPacksByKind(rangePacks);

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
      const byDate = new Map<string, { day: string; Yearly: number; Monthly: number; Lifetime: number }>();
      for (const r of rows) {
        if (r.grain !== 'day') continue;
        const date = String(r.event_date || '').slice(0, 10);
        if (!date) continue;
        const cur = byDate.get(date) || { day: date.slice(5), Yearly: 0, Monthly: 0, Lifetime: 0 };
        if (r.pack_name === YEARLY_ROLLUP) cur.Yearly = n(r.unique_users);
        if (r.pack_name === MONTHLY_ROLLUP) cur.Monthly = n(r.unique_users);
        if (r.pack_name === LIFETIME_ROLLUP) cur.Lifetime = n(r.unique_users);
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
  const compareByKind = splitPacksByKind(comparePacks);
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
              ? 'Unique people who confirmed a pack. Banknote uses Subs_pack / Subs_confirm. Coinzy uses subs_pack / subs_confirm (and paid_purchase).'
              : `Unique people who confirmed a pack in ${product.shortName}. ${packEventHint(productId)}. Yearly list price $${listPrice ?? '—'}.`}
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
                const unique = n(row?.unique_users);
                const yearly = n(row?.yearly_users);
                const monthly = n(row?.monthly_users);
                const lifetime = n(row?.lifetime_users);
                const other = Math.max(0, unique - yearly - monthly - lifetime);
                const clickers = n(row?.clickers);
                const clickRate = clickers > 0 ? unique / clickers : row?.click_to_confirm_rate;
                return (
                  <div key={p.id} className="packs-compare-card" data-app={p.id}>
                    <AppMark product={p.id} size={32} />
                    <div className="packs-compare-card-copy">
                      <strong style={{ color: p.color }}>{p.shortName}</strong>
                      <span>{packEventHint(p.id)}</span>
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
                        <dt>Monthly</dt>
                        <dd>{fmtNumber(monthly)}</dd>
                      </div>
                      <div>
                        <dt>Lifetime</dt>
                        <dd>{fmtNumber(lifetime)}</dd>
                      </div>
                      <div>
                        <dt>Click → confirm</dt>
                        <dd>{clickRate == null ? '—' : fmtPercent(clickRate)}</dd>
                      </div>
                      <div>
                        <dt>Est. yearly</dt>
                        <dd>{row?.yearly_revenue == null ? '—' : fmtUsd(row.yearly_revenue)}</dd>
                      </div>
                    </dl>
                    <MixMeter yearly={yearly} monthly={monthly} lifetime={lifetime} other={other} />
                    {p.id === 'coinzy' && (
                      <OfferMeter
                        full={n(row?.full_users)}
                        half={n(row?.half_users)}
                        trial={n(row?.trial_users)}
                      />
                    )}
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

            <div className="packs-split">
              <section className="packs-panel" data-kind="yearly">
                <h3>Yearly packs</h3>
                  <RankedPacks
                  packs={compareByKind.yearly}
                  total={compareTotal}
                  showApp
                  colorByLabel={colorByLabel}
                  empty="No yearly packs in this range."
                />
              </section>
              <section className="packs-panel" data-kind="monthly">
                <h3>Monthly packs</h3>
                <RankedPacks
                  packs={compareByKind.monthly}
                  total={compareTotal}
                  showApp
                  colorByLabel={colorByLabel}
                  empty="No monthly packs in this range."
                />
              </section>
              <section className="packs-panel" data-kind="lifetime">
                <h3>Lifetime packs</h3>
                <RankedPacks
                  packs={compareByKind.lifetime}
                  total={compareTotal}
                  showApp
                  colorByLabel={colorByLabel}
                  empty="No lifetime packs in this range."
                />
              </section>
            </div>
            {compareByKind.other.length > 0 && (
              <section className="packs-panel">
                <h3>Other packs</h3>
                <RankedPacks
                  packs={compareByKind.other}
                  total={compareTotal}
                  showApp
                  colorByLabel={colorByLabel}
                />
              </section>
            )}
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
                <strong>{fmtNumber(uniqueUsers)}</strong> unique people confirmed a pack.
                {' '}
                Yearly <strong>{fmtNumber(yearlyUsers)}</strong>
                {uniqueUsers > 0 ? ` (${fmtPercent(yearlyShare)})` : ''}
                {' · '}monthly <strong>{fmtNumber(monthlyUsers)}</strong>
                {uniqueUsers > 0 ? ` (${fmtPercent(monthlyShare)})` : ''}
                {' · '}lifetime <strong>{fmtNumber(lifetimeUsers)}</strong>
                {uniqueUsers > 0 ? ` (${fmtPercent(lifetimeShare)})` : ''}.
                {clickRate != null && (
                  <> Pack click → confirm {fmtPercent(clickRate)}.</>
                )}
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
                <div className="why">Confirmed a pack — one person per day</div>
              </div>
              <div className="kpi-card packs-kpi" data-tone="yearly">
                <div className="packs-kpi-icon"><Calendar size={16} /></div>
                <div className="label">Yearly unique</div>
                <div className="value">{fmtNumber(yearlyUsers)}</div>
                <div className="why">{uniqueUsers > 0 ? fmtPercent(yearlyShare) : '—'} of people who bought</div>
              </div>
              <div className="kpi-card packs-kpi" data-tone="monthly">
                <div className="packs-kpi-icon"><CalendarDays size={16} /></div>
                <div className="label">Monthly unique</div>
                <div className="value">{fmtNumber(monthlyUsers)}</div>
                <div className="why">{uniqueUsers > 0 ? fmtPercent(monthlyShare) : '—'} of people who bought</div>
              </div>
              <div className="kpi-card packs-kpi" data-tone="lifetime">
                <div className="packs-kpi-icon"><Gem size={16} /></div>
                <div className="label">Lifetime unique</div>
                <div className="value">{fmtNumber(lifetimeUsers)}</div>
                <div className="why">{productId === 'coinzy' ? 'IAP, not a subscription' : 'Lifetime pack'}</div>
              </div>
              <div className="kpi-card packs-kpi" data-tone="money">
                <div className="packs-kpi-icon"><CircleDollarSign size={16} /></div>
                <div className="label">Yearly estimated</div>
                <div className="value">{yearlyRevenue == null ? '—' : fmtUsd(yearlyRevenue)}</div>
                <div className="why">
                  {listPrice == null
                    ? 'No yearly list price for this app'
                    : `${fmtNumber(yearlyUsers)} × $${listPrice} list — not store USD`}
                </div>
              </div>
              <div className="kpi-card packs-kpi" data-tone="people">
                <div className="packs-kpi-icon"><MousePointerClick size={16} /></div>
                <div className="label">Click → confirm</div>
                <div className="value">{clickRate == null ? '—' : fmtPercent(clickRate)}</div>
                <div className="why">{fmtNumber(clickers)} unique pack clickers</div>
              </div>
              <div className="kpi-card packs-kpi" data-tone="confirms">
                <div className="packs-kpi-icon"><Repeat size={16} /></div>
                <div className="label">Confirms / person</div>
                <div className="value">{retries == null ? '—' : fmtDecimal(retries)}</div>
                <div className="why">Above 1.0 means payment retries</div>
              </div>
              <div className="kpi-card packs-kpi" data-tone="confirms">
                <div className="packs-kpi-icon"><Package size={16} /></div>
                <div className="label">Confirm taps</div>
                <div className="value">{fmtNumber(n(rangeAll?.takes))}</div>
                <div className="why">{rangePacks.length} named packs</div>
              </div>
            </div>

            <div className="packs-mix-row">
              <MixMeter yearly={yearlyUsers} monthly={monthlyUsers} lifetime={lifetimeUsers} other={otherUsers} />
              {productId === 'coinzy' ? (
                <OfferMeter full={fullUsers} half={halfUsers} trial={trialUsers} />
              ) : kindCounts.length > 0 ? (
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
              ) : null}
            </div>

            <ChartCard title="Yearly vs monthly vs lifetime, unique people per day">
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: chart.tick, fontSize: 11 }} />
                  <YAxis tick={{ fill: chart.tick, fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={<PackTooltip />} />
                  <Legend />
                  <Bar dataKey="Yearly" name="Yearly" fill="var(--brand-banknote-gold)" radius={[3, 3, 0, 0]} maxBarSize={16} />
                  <Bar dataKey="Monthly" name="Monthly" fill="var(--accent)" radius={[3, 3, 0, 0]} maxBarSize={16} />
                  <Bar dataKey="Lifetime" name="Lifetime" fill="#a78bfa" radius={[3, 3, 0, 0]} maxBarSize={16} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <div className="packs-split packs-split-3">
              <section className="packs-panel" data-kind="yearly">
                <h3>Yearly packs</h3>
                <RankedPacks packs={yearlyPacks} total={uniqueUsers} listPrice={listPrice} empty="No yearly packs in this range." />
              </section>
              <section className="packs-panel" data-kind="monthly">
                <h3>Monthly packs</h3>
                <RankedPacks packs={monthlyPacks} total={uniqueUsers} listPrice={listPrice} empty="No monthly packs in this range." />
              </section>
              <section className="packs-panel" data-kind="lifetime">
                <h3>Lifetime packs</h3>
                <RankedPacks packs={lifetimePacks} total={uniqueUsers} listPrice={listPrice} empty="No lifetime packs in this range." />
              </section>
            </div>

            {otherPacks.length > 0 && (
              <section className="packs-panel">
                <h3>Other packs</h3>
                <RankedPacks packs={otherPacks} total={uniqueUsers} listPrice={listPrice} />
              </section>
            )}

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
                  { [...yearlyPacks, ...monthlyPacks, ...lifetimePacks, ...otherPacks].map((p) => {
                    const kind = packKind(p);
                    const users = n(p.unique_users);
                    const share = pct(users, uniqueUsers);
                    const est = kind === 'Yearly' && listPrice != null ? users * listPrice : null;
                    return (
                      <tr key={String(p.pack_name)}>
                        <td>{packDisplayName(p.pack_name)}</td>
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
              {[...yearlyPacks, ...monthlyPacks, ...lifetimePacks, ...otherPacks].map((p) => {
                const kind = packKind(p);
                const users = n(p.unique_users);
                const share = pct(users, uniqueUsers);
                const est = kind === 'Yearly' && listPrice != null ? users * listPrice : null;
                return (
                  <article key={String(p.pack_name)} className="packs-card">
                    <header>
                      <strong>{packDisplayName(p.pack_name)}</strong>
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
