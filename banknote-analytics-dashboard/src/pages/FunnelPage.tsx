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
import { fmtNumber, fmtPercent, QueryParams, FunnelRow, FunnelPackRow } from '@/lib/api';
import { useProduct } from '@/lib/product';
import { useTheme } from '@/lib/theme';

interface Props {
  funnelId: 'identify' | 'identify-nav' | 'identify-home' | 'identify-camera' | 'identify-gallery' | 'collection' | 'global' | 'marketplace' | 'feed' | 'paywall' | 'onboarding' | 'paywall-onboarding' | 'expert';
  params: QueryParams;
  setParams: (p: QueryParams) => void;
  applyFilters: () => void;
}

const PATH_STARTS: Record<Props['funnelId'], string[]> = {
  identify: [],
  'identify-nav': [],
  'identify-home': [],
  'identify-camera': [],
  'identify-gallery': [],
  collection: [],
  global: [],
  marketplace: [],
  feed: [],
  paywall: [],
  onboarding: [],
  'paywall-onboarding': [],
  expert: ['buy_credits'],
};

const PATH_TITLES: Record<string, string> = {
  collection_tab: 'Private collection',
  collection_screen: 'Private collection',
  global_cta: 'Global catalogue',
  global_screen: 'Global catalogue',
  open_kpi: 'Opened either catalogue',
  market_tab: 'Marketplace',
  market_screen: 'Marketplace',
  feed_tab: 'Feed',
  feed_screen: 'Feed',
  entry: 'Started Identify',
  camera: 'Started Identify',
  photos: 'After crop',
  shutter: 'Camera shutter',
  gallery: 'Gallery pick',
  attempt: 'API started',
  success: 'ID success',
  details: 'Details',
  photo_1: 'First photo',
  photo_click_1: 'First photo clicked',
  photo_upload_1: 'First photo uploaded',
  photo_2: 'Second photo',
  photo_click_2: 'Second photo clicked',
  photo_upload_2: 'Second photo uploaded',
  crop_1: 'Crop first image',
  crop_confirm_1: 'After first crop',
  crop_2: 'Crop second image',
  crop_confirm_2: 'After second crop',
  paywall: 'Paywall shown',
  pack: 'Paywall',
  button: 'Paywall',
  native: 'Paywall',
  onboarding: 'Onboarding',
  onboarding_done: 'Onboarding',
  onboarding_subs: 'Paywall',
  logo: 'Onboarding',
  value_1: 'Onboarding',
  value_2: 'Onboarding',
  value_3: 'Onboarding',
  value_4: 'Onboarding',
  value_5: 'Onboarding',
  login: 'Onboarding',
  notification: 'Onboarding',
  landing: 'Book an evaluation',
  buy_credits: 'Buy credits',
};

const FUNNEL_GUIDE: Record<Props['funnelId'], { question: string; how: string }> = {
  identify: {
    question: 'Of everyone who starts a scan, how many get a successful ID — and then open details / add to collection?',
    how: 'Main steps: camera → first photo → crop → after crop → second photo → crop → after crop → submit → success → top 5 → details → add to collection. First/second photo count clicked or uploaded so gallery is not missing. The clicked vs uploaded rows are the camera/gallery split. Nav/home taps are side rows (tab restore and deep links skip them). Use Scan · camera for click → crop → after crop only.',
  },
  'identify-nav': {
    question: 'Of people who opened Identify from the bottom bar, where do they drop off?',
    how: 'Every step only counts people who fired Identify_bottom_nav. Coinzy also drops anyone who fired Identify_home that day, because the nav event also fires from the Home CTA.',
  },
  'identify-home': {
    question: 'Of people who opened Identify from home / banner, where do they drop off?',
    how: 'Every step only counts people who fired Identify_home. Camera, photos, submit, and success are that group only — not everyone in Identify.',
  },
  'identify-camera': {
    question: 'Of people who used the camera shutter, where do they drop off?',
    how: 'Every step only counts people who used Photo_clicked / photo_clicked_*. Main path is first photo clicked → crop → after crop → second photo clicked → crop → after crop → submit. Gallery rows are not shown.',
  },
  'identify-gallery': {
    question: 'Of people who used the gallery, where do they drop off?',
    how: 'Every step only counts gallery users. Banknote: first uploaded → crop → after crop → second uploaded → crop → after crop → submit. Coinzy has no gallery tap event, so this is crop/clicked minus Photo_clicked. Camera permission is not on this tab.',
  },
  collection: {
    question: 'Of people who started a session, how many open their own collection and then an item?',
    how: 'Starts with everyone who opened the app that day (session_start / App_open / first_open). Then collection screen → a card → a sub-folder → item details. Bottom nav is a side step.',
  },
  global: {
    question: 'Of people who started a session, how many open the world / global catalogue and then an item?',
    how: 'Starts with everyone who opened the app that day (session_start / App_open / first_open). Then global catalogue screen → tap an item → details. The CTA is a side step.',
  },
  marketplace: {
    question: 'Of people who open Marketplace, how many contact a seller?',
    how: 'Marketplace tab → listings → a sale → contact seller.',
  },
  feed: {
    question: 'Of people who open the Feed, how many like, comment, or post?',
    how: 'Feed tab → feed screen → like/comment. Posting is extra, not required.',
  },
  paywall: {
    question: 'Of people who see the in-app paywall, how many pick a pack, tap subscribe, and confirm — and which packs do they choose?',
    how: 'Banknote: paywall shown → pack click → CTA (trial / subscribe / purchase) → Google Play sheet (subs_native) → confirm. Coinzy: shown → pack → CTA → confirm. The table below is unique people per pack name × discounted / non-discounted. First-run screens are Funnels → Onboarding. Purchase from that group is Funnels → Onboarding → subs.',
  },
  onboarding: {
    question: 'Of people who start onboarding, how many finish it?',
    how: 'Banknote: started / screen view → completed (next, camera, and feature are side rows — slides share one event with a screen index). Coinzy: logo → value 1–5 → login → notification → completed. Experiment suffixes are unioned. Camera / gifts / skip are side rows. Subscription from this group is Funnels → Onboarding → subs.',
  },
  'paywall-onboarding': {
    question: 'Of people who go through onboarding, how many take a subscription from there?',
    how: 'Only onboarding users are in this funnel. Banknote has no Subs_page_onboarding — first step is subscription_shown, then pack → CTA → Google Play sheet → confirm. Coinzy: any onboarding paywall page → pack → CTA → confirm. Skip is a blocked outcome. Pack mix is unique people per pack among that group. First-run screens are Funnels → Onboarding.',
  },
  expert: {
    question: 'Of people who open Expert Evaluation, how many get a report — and how many buy credits?',
    how: 'Main path: landing → upload photos → continue with a credit or payment → request queued → report. Credits path: buy credits → pay → token received → consumed. Cancel / fail / refund are blocked outcomes. Coinzy only.',
  },
};

const COINZY_IDENTIFY_GUIDE: Record<'identify' | 'identify-nav' | 'identify-home' | 'identify-camera' | 'identify-gallery', { question: string; how: string }> = {
  identify: {
    question: 'Of everyone who opens the Identify camera, how many submit photos, get a successful ID, and open details?',
    how: 'Main path: camera → first crop → first photo after crop → second crop → second photo after crop → submit → API started → success → details. Crop ticks are side rows (auto-crop skips them). The combined photo_clicked_1 ∪ photo_clicked_2 row sits after both crops (image 1 or 2, not “both”). Shutter vs gallery are parallel sources. Add-to-collection cannot be measured.',
  },
  'identify-nav': {
    question: 'Of people who opened Identify from the bottom bar (and not from Home), where do they drop off?',
    how: 'Cohort = Identify_bottom_nav minus Identify_home. Later steps (camera → crop → after crop → submit → API started → success → details) only count that group. Nav also fires from Home, so Home users are excluded here — use Scan · home / banner for them.',
  },
  'identify-home': {
    question: 'Of people who tapped Identify on home / banner, where do they drop off?',
    how: 'Cohort = Identify_home. Camera → crop → after crop → submit → API started → success → details only count that group, not everyone who opened the camera.',
  },
  'identify-camera': {
    question: 'Of people who used the shutter (Photo_clicked), where do they drop off?',
    how: 'Cohort = Photo_clicked. Main path: shutter → first crop → first photo after crop → second crop → second photo after crop → submit → API started → success → details. Quota-blocked submits never start the API, so they drop at API started, not at Identification success. Permission is on this tab. Gallery rows are not shown.',
  },
  'identify-gallery': {
    question: 'Of people who used gallery (inferred), where do they drop off?',
    how: 'Cohort = crop/clicked minus Photo_clicked. Main path starts at the first crop screen (the inferred gallery row is side context — gallery tap has no event). Then first photo after crop → second crop → second photo after crop → submit → API started → success → details. No shutter, no permission.',
  },
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

const DROP_RED = '#dc2626';
const DROP_RED_MUTED = '#fca5a5';
const JOIN_GREEN = '#059669';

function hopKey(h: FlowHop) {
  return `${h.from.step_id}->${h.to.step_id}`;
}

function worstHop(hops: FlowHop[]): FlowHop | null {
  const drops = hops.filter((h) => h.gained === 0 && h.dropped > 0);
  if (!drops.length) return null;
  return [...drops].sort((a, b) => b.dropped - a.dropped)[0];
}

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

function FunnelBars({ rows, worstToId }: { rows: FunnelRow[]; worstToId?: string | null }) {
  const maxUsers = Math.max(1, ...rows.map((r) => num(r.users)));
  return (
    <div className="funnel-bars">
      {rows.map((r) => {
        const users = num(r.users);
        const w = Math.max(3, Math.round((users / maxUsers) * 100));
        const drop = isTrue(r.is_drop);
        const core = isTrue(r.is_core);
        const largest = worstToId != null && String(r.step_id) === worstToId;
        return (
          <div
            key={String(r.step_id)}
            className={`funnel-bar-row${drop ? ' drop' : ''}${core ? ' core' : ''}${largest ? ' largest-drop' : ''}`}
          >
            <div className="funnel-bar-label" title={String(r.event_names || '')}>
              {String(r.step_label)}
              {largest ? <span className="badge danger">biggest leak</span> : null}
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
  worstToId,
  tipStyle,
  tick,
  grid,
  accent = '#4f8cff',
}: {
  steps: FunnelRow[];
  worstToId?: string | null;
  tipStyle: CSSProperties;
  tick: string;
  grid: string;
  accent?: string;
}) {
  const data = steps.map((s) => ({
    step: shortLabel(String(s.step_label), 16),
    full: String(s.step_label),
    users: num(s.users),
    id: String(s.step_id),
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
          <Bar dataKey="users" name="Unique users" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((d) => (
              <Cell key={d.id} fill={d.id === worstToId ? DROP_RED : accent} />
            ))}
            <LabelList
              dataKey="users"
              position="top"
              fill={tick}
              fontSize={11}
              formatter={(v: number | string) => fmtNumber(Number(v))}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function HopDropChart({
  hops,
  worst,
  tipStyle,
  tick,
  grid,
}: {
  hops: FlowHop[];
  worst: FlowHop | null;
  tipStyle: CSSProperties;
  tick: string;
  grid: string;
}) {
  if (!hops.length) return null;
  const worstId = worst ? hopKey(worst) : null;
  const data = hops.map((h) => {
    const joined = h.gained > 0;
    return {
      hop: shortLabel(`${String(h.from.step_label)} → ${String(h.to.step_label)}`, 42),
      full: `${String(h.from.step_label)} → ${String(h.to.step_label)}`,
      value: joined ? h.gained : h.dropped,
      kind: joined ? 'joined' : 'dropped',
      id: hopKey(h),
    };
  });

  return (
    <div className="funnel-recharts hop-bars" style={{ height: Math.max(220, 70 + data.length * 36) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 36, left: 8, bottom: 8 }}>
          <CartesianGrid stroke={grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fill: tick, fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="hop"
            width={220}
            tick={{ fill: tick, fontSize: 11 }}
          />
          <Tooltip
            contentStyle={tipStyle}
            formatter={(value: number, _name, item) => {
              const kind = item?.payload?.kind;
              return [
                kind === 'joined'
                  ? `${fmtNumber(value)} extra people (skipped the previous screen)`
                  : `${fmtNumber(value)} people left`,
                item?.payload?.full || 'Hop',
              ];
            }}
          />
          <Bar dataKey="value" name="Users" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {data.map((d) => (
              <Cell
                key={d.id}
                fill={
                  d.kind === 'joined'
                    ? JOIN_GREEN
                    : d.id === worstId
                      ? DROP_RED
                      : DROP_RED_MUTED
                }
              />
            ))}
            <LabelList dataKey="value" position="right" fill={tick} fontSize={11} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function FlowTable({ hops, worst }: { hops: FlowHop[]; worst: FlowHop | null }) {
  const worstId = worst ? hopKey(worst) : null;
  return (
    <div className="table-wrap funnel-table funnel-flow-table">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Between these screens</th>
            <th>People on first</th>
            <th>People on next</th>
            <th>Continued</th>
            <th>Did not continue</th>
            <th>Share who left</th>
            <th>In plain words</th>
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
            const largest = hopKey(f) === worstId;
            return (
              <tr
                key={`${f.from.step_id}-${f.to.step_id}`}
                className={largest ? 'row-largest-drop' : over ? 'row-gain' : ''}
              >
                <td>{i + 1}</td>
                <td>
                  <span className="flow-from">{String(f.from.step_label)}</span>
                  <span className="flow-arrow"> → </span>
                  <span className="flow-to">{String(f.to.step_label)}</span>
                  {largest ? <span className="badge danger">biggest leak</span> : null}
                </td>
                <td>{fmtNumber(f.fromUsers)}</td>
                <td>{fmtNumber(f.toUsers)}</td>
                <td className={over ? 'pct-over' : ''}>{pct(f.convertRate)}</td>
                <td className={largest ? 'pct-drop' : ''}>{over ? '—' : fmtNumber(f.dropped)}</td>
                <td className={f.dropped > 0 && !over ? 'pct-drop' : ''}>
                  {over ? '—' : pct(f.dropRate)}
                </td>
                <td className={largest ? 'pct-drop' : 'muted'}>
                  {over
                    ? `${fmtNumber(f.gained)} extra people showed up here without the previous step`
                    : largest
                      ? `${fmtNumber(f.dropped)} people stopped here — biggest leak`
                      : f.dropped > 0
                        ? `${fmtNumber(f.dropped)} people did not continue`
                        : 'Everyone continued'}
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
  const isCoinzy = product.id === 'coinzy';
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
    const pathDrops = segments.map((seg) => ({
      title: seg.title,
      worst: worstHop(seg.hops),
    }));
    const overall = [...pathDrops]
      .filter((p) => p.worst)
      .sort((a, b) => (b.worst?.dropped || 0) - (a.worst?.dropped || 0))[0] || null;
    return {
      entry,
      last,
      convert: entry > 0 ? last / entry : null,
      overall,
      pathDrops,
    };
  }, [segments]);

  const overallWorstToId = headline?.overall?.worst
    ? String(headline.overall.worst.to.step_id)
    : null;

  const isIdentify =
    funnelId === 'identify'
    || funnelId === 'identify-nav'
    || funnelId === 'identify-home'
    || funnelId === 'identify-camera'
    || funnelId === 'identify-gallery';
  const showPhotoMix = funnelId === 'identify' || funnelId === 'identify-nav' || funnelId === 'identify-home';
  const isPaywall = funnelId === 'paywall' || funnelId === 'paywall-onboarding';
  const packs = (data?.packs || []) as FunnelPackRow[];
  const guide =
    isIdentify && isCoinzy
      ? COINZY_IDENTIFY_GUIDE[funnelId as keyof typeof COINZY_IDENTIFY_GUIDE]
      : FUNNEL_GUIDE[funnelId];

  const photoMix = useMemo(() => {
    if (!showPhotoMix) return null;
    const users = (id: string) => num(rows.find((r) => String(r.step_id) === id)?.users);
    if (rows.some((r) => String(r.step_id) === 'photo_upload_1')) {
      return {
        kind: 'banknote' as const,
        hasGallery: true,
        got1: users('photo_1'),
        click1: users('photo_click_1'),
        upload1: users('photo_upload_1'),
        got2: users('photo_2'),
        click2: users('photo_click_2'),
        upload2: users('photo_upload_2'),
        chart: [
          { slot: 'First image', Camera: users('photo_click_1'), Gallery: users('photo_upload_1') },
          { slot: 'Second image', Camera: users('photo_click_2'), Gallery: users('photo_upload_2') },
        ],
      };
    }
    if (rows.some((r) => String(r.step_id) === 'shutter')) {
      return {
        kind: 'coinzy' as const,
        hasGallery: true,
        shutter: users('shutter'),
        gallery: users('gallery'),
        merged: users('photos'),
        merged1: users('photo_click_1'),
        merged2: users('photo_click_2'),
        chart: [
          { slot: 'Shutter', People: users('shutter') },
          { slot: 'Gallery (inferred)', People: users('gallery') },
          { slot: 'After crop (merged)', People: users('photos') },
        ],
      };
    }
    return null;
  }, [isIdentify, rows]);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>{data?.title || 'Funnel'}</h2>
          <p>
            {guide?.question || data?.description} · {product.shortName}
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
            {guide && (
              <div className="page-hint funnel-guide">
                <p>
                  <strong>What this page answers:</strong> {guide.question}
                </p>
                <p>{guide.how}</p>
                <ul>
                  <li>
                    <strong>People</strong> = distinct people in your date range, not number of taps.
                    Someone who scans five times still counts as one person at a step.
                  </li>
                  <li>
                    <strong>Once</strong> = they did this screen exactly one time.
                    <strong>Again (2+)</strong> = they came back to it. Low “again” on a core step is a habit gap.
                  </li>
                  <li>
                    <strong>Times / person</strong> = taps ÷ people. High times + few people = power users only.
                  </li>
                  <li>
                    <strong>Red</strong> = where we lose the most people. That is the first place to fix.
                  </li>
                  <li>
                    <strong>Green</strong> = more people appear on a later screen than the previous one.
                    They skipped a logged step, or the app recorded the later screen without the earlier one.
                  </li>
                  <li>
                    Main steps are the journey you care about. Other rows (permission, gallery split, cancel)
                    are extra context — they are not required to “finish” the journey.
                  </li>
                  {showPhotoMix && photoMix?.kind === 'banknote' && (
                    <li>
                      <strong>Camera vs gallery:</strong> the main first/second photo step is clicked or
                      uploaded. Crop and after-crop sit between the two photos. Clicked vs uploaded rows
                      underneath are the split.
                    </li>
                  )}
                  {showPhotoMix && photoMix?.kind === 'coinzy' && (
                    <li>
                      <strong>Shutter vs gallery:</strong> parallel after the camera screen. Then first
                      crop → first photo after crop → second crop → second photo after crop → submit
                      → API started → success. Crop ticks are side rows (auto-crop skips them). The
                      “either after-crop photo” row is image 1 <em>or</em> 2, listed after both crops
                      — it is not a step that happens before cropping.
                    </li>
                  )}
                  {isIdentify && isCoinzy && (
                    <li>
                      <strong>Add to collection</strong> is not on this funnel. Coinzy has no live
                      Firebase success event for it (<code>Added_to_collection_identified</code> is
                      dead). Owned / sub-collection events are Collection-tab actions, not Identify
                      steps.
                    </li>
                  )}
                </ul>
              </div>
            )}

            {headline && (
              <div className={`funnel-kpis${headline.pathDrops.length > 1 ? ' multi' : ''}`}>
                <div className="funnel-kpi">
                  <span className="funnel-kpi-label">Started</span>
                  <span className="funnel-kpi-value">{fmtNumber(headline.entry)}</span>
                  <span className="funnel-kpi-sub">People at the first main step</span>
                </div>
                <div className="funnel-kpi">
                  <span className="funnel-kpi-label">Finished</span>
                  <span className="funnel-kpi-value">{fmtNumber(headline.last)}</span>
                  <span className="funnel-kpi-sub">People at the last main step</span>
                </div>
                <div className="funnel-kpi">
                  <span className="funnel-kpi-label">Made it all the way</span>
                  <span className="funnel-kpi-value">{pct(headline.convert)}</span>
                  <span className="funnel-kpi-sub">Finished ÷ started</span>
                </div>
                <div className="funnel-kpi largest-drop">
                  <span className="funnel-kpi-label">Biggest leak</span>
                  <span className="funnel-kpi-value">
                    {headline.overall?.worst
                      ? `${fmtNumber(headline.overall.worst.dropped)} (${pct(headline.overall.worst.dropRate)})`
                      : '—'}
                  </span>
                  {headline.overall?.worst && (
                    <span className="funnel-kpi-sub">
                      {headline.pathDrops.length > 1 ? `${headline.overall.title}: ` : ''}
                      Left between {String(headline.overall.worst.from.step_label)} and {String(headline.overall.worst.to.step_label)}
                    </span>
                  )}
                </div>
                {headline.pathDrops.length > 1 &&
                  headline.pathDrops
                    .filter((p) => p.worst && p.title !== headline.overall?.title)
                    .map((p) => (
                      <div key={p.title} className="funnel-kpi largest-drop">
                        <span className="funnel-kpi-label">Biggest leak · {p.title}</span>
                        <span className="funnel-kpi-value">
                          {fmtNumber(p.worst!.dropped)} ({pct(p.worst!.dropRate)})
                        </span>
                        <span className="funnel-kpi-sub">
                          {String(p.worst!.from.step_label)} → {String(p.worst!.to.step_label)}
                        </span>
                      </div>
                    ))}
              </div>
            )}

            {photoMix?.kind === 'banknote' && (
              <>
                <div className="funnel-kpis multi">
                  <div className="funnel-kpi">
                    <span className="funnel-kpi-label">First image</span>
                    <span className="funnel-kpi-value">{fmtNumber(photoMix.got1)}</span>
                    <span className="funnel-kpi-sub">Camera or gallery</span>
                  </div>
                  <div className="funnel-kpi">
                    <span className="funnel-kpi-label">First · camera</span>
                    <span className="funnel-kpi-value">{fmtNumber(photoMix.click1)}</span>
                    <span className="funnel-kpi-sub">photo_clicked_1</span>
                  </div>
                  <div className="funnel-kpi">
                    <span className="funnel-kpi-label">First · gallery</span>
                    <span className="funnel-kpi-value">{fmtNumber(photoMix.upload1)}</span>
                    <span className="funnel-kpi-sub">photo_uploaded_1</span>
                  </div>
                  <div className="funnel-kpi">
                    <span className="funnel-kpi-label">Second image</span>
                    <span className="funnel-kpi-value">{fmtNumber(photoMix.got2)}</span>
                    <span className="funnel-kpi-sub">Camera or gallery</span>
                  </div>
                  <div className="funnel-kpi">
                    <span className="funnel-kpi-label">Second · camera</span>
                    <span className="funnel-kpi-value">{fmtNumber(photoMix.click2)}</span>
                    <span className="funnel-kpi-sub">photo_clicked_2</span>
                  </div>
                  <div className="funnel-kpi">
                    <span className="funnel-kpi-label">Second · gallery</span>
                    <span className="funnel-kpi-value">{fmtNumber(photoMix.upload2)}</span>
                    <span className="funnel-kpi-sub">photo_uploaded_2</span>
                  </div>
                </div>
                <ChartCard title="Camera vs gallery — who took the photo which way">
                  <p className="funnel-note" style={{ marginTop: 0 }}>
                    Combined first/second image is a union (someone can appear in both camera and gallery).
                    Bars are distinct people, not a share that must add to 100%.
                  </p>
                  <div className="funnel-recharts" style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={photoMix.chart} margin={{ top: 12, right: 12, left: 4, bottom: 8 }}>
                        <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="slot" tick={{ fill: chart.tick, fontSize: 12 }} />
                        <YAxis tick={{ fill: chart.tick, fontSize: 11 }} width={44} />
                        <Tooltip contentStyle={tipStyle} />
                        <Bar dataKey="Camera" fill={product.color} radius={[4, 4, 0, 0]} maxBarSize={48} />
                        <Bar dataKey="Gallery" fill="#fbbf24" radius={[4, 4, 0, 0]} maxBarSize={48} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
              </>
            )}

            {photoMix?.kind === 'coinzy' && (
              <>
                <div className="funnel-kpis multi">
                  <div className="funnel-kpi">
                    <span className="funnel-kpi-label">Shutter</span>
                    <span className="funnel-kpi-value">{fmtNumber(photoMix.shutter)}</span>
                    <span className="funnel-kpi-sub">Photo_clicked only</span>
                  </div>
                  <div className="funnel-kpi">
                    <span className="funnel-kpi-label">Gallery (inferred)</span>
                    <span className="funnel-kpi-value">{fmtNumber(photoMix.gallery)}</span>
                    <span className="funnel-kpi-sub">Crop/clicked, never shutter</span>
                  </div>
                  <div className="funnel-kpi">
                    <span className="funnel-kpi-label">After crop (merged)</span>
                    <span className="funnel-kpi-value">{fmtNumber(photoMix.merged)}</span>
                    <span className="funnel-kpi-sub">photo_clicked_1 ∪ photo_clicked_2</span>
                  </div>
                  <div className="funnel-kpi">
                    <span className="funnel-kpi-label">First after crop</span>
                    <span className="funnel-kpi-value">{fmtNumber(photoMix.merged1)}</span>
                    <span className="funnel-kpi-sub">Both paths</span>
                  </div>
                  <div className="funnel-kpi">
                    <span className="funnel-kpi-label">Second after crop</span>
                    <span className="funnel-kpi-value">{fmtNumber(photoMix.merged2)}</span>
                    <span className="funnel-kpi-sub">Both paths</span>
                  </div>
                </div>
                <ChartCard title="Shutter vs gallery — parallel after camera">
                  <p className="funnel-note" style={{ marginTop: 0 }}>
                    Gallery tap has no Firebase event. Gallery-only people are inferred as crop or
                    photo_clicked_* minus Photo_clicked. Mixed shutter+gallery users count as shutter.
                    After-crop is the merge — not “taken”.
                  </p>
                  <div className="funnel-recharts" style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={photoMix.chart} margin={{ top: 12, right: 12, left: 4, bottom: 8 }}>
                        <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="slot" tick={{ fill: chart.tick, fontSize: 12 }} />
                        <YAxis tick={{ fill: chart.tick, fontSize: 11 }} width={44} />
                        <Tooltip contentStyle={tipStyle} />
                        <Bar dataKey="People" fill={product.color} radius={[4, 4, 0, 0]} maxBarSize={64} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
              </>
            )}

            {isPaywall && packs.length === 0 && (
              <div className="page-hint">
                No pack click events in this date range, so there is no pack mix to show.
              </div>
            )}

            {isPaywall && packs.length > 0 && (
              <ChartCard title="Pack mix — unique people per pack">
                <p className="funnel-note" style={{ marginTop: 0 }}>
                  Each row is distinct people who tapped that pack ({funnelId === 'paywall-onboarding' ? 'among onboarding users only' : 'Banknote: Subs_pack with pack name + discounted/non-discounted'}).
                  Confirmed = those same people also fired a purchase confirm in this date range.
                </p>
                <div className="funnel-recharts" style={{ height: Math.min(360, 80 + packs.length * 36) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={packs.map((p) => ({
                        pack: `${p.pack_name || '(unnamed)'} · ${p.discount_type || 'non-discounted'}`,
                        Users: num(p.users),
                        Confirmed: num(p.confirmed_users),
                      }))}
                      layout="vertical"
                      margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid stroke={chart.grid} strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fill: chart.tick, fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="pack"
                        width={180}
                        tick={{ fill: chart.tick, fontSize: 11 }}
                      />
                      <Tooltip contentStyle={tipStyle} />
                      <Bar dataKey="Users" fill={product.color} radius={[0, 4, 4, 0]} maxBarSize={22} />
                      <Bar dataKey="Confirmed" fill="#34d399" radius={[0, 4, 4, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="funnel-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Pack</th>
                        <th>Discount</th>
                        <th>People</th>
                        <th>Taps</th>
                        <th>Taps / person</th>
                        <th>Also confirmed</th>
                        <th>Confirm rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {packs.map((p) => (
                        <tr key={`${p.pack_name}-${p.discount_type}`}>
                          <td>{String(p.pack_name || '(unnamed pack)')}</td>
                          <td>{String(p.discount_type || 'non-discounted')}</td>
                          <td>{fmtNumber(num(p.users))}</td>
                          <td>{fmtNumber(num(p.hits))}</td>
                          <td>{num(p.hits_per_user) ? num(p.hits_per_user).toFixed(2) : '—'}</td>
                          <td>{fmtNumber(num(p.confirmed_users))}</td>
                          <td>{pct(p.confirm_rate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ChartCard>
            )}

            <div className="chart-grid">
              <ChartCard title="Every screen — how many people" className={segments.length > 1 ? undefined : 'half'}>
                <p className="funnel-note" style={{ marginTop: 0 }}>
                  Longer bar = more people reached that screen. The last column is “what share continued
                  from the previous <strong>main</strong> step”. Red is the biggest leak.
                </p>
                <FunnelBars rows={rows} worstToId={overallWorstToId} />
              </ChartCard>

              {segments.map((seg) => {
                const worst = worstHop(seg.hops);
                return (
                  <ChartCard
                    key={`${seg.title}-bars`}
                    title={`${seg.title} — people at each main step`}
                    className="half"
                  >
                    <p className="funnel-note" style={{ marginTop: 0 }}>
                      Only the main journey. Red is where we lose the most people.
                    </p>
                    <PathBarChart
                      steps={seg.steps}
                      worstToId={worst ? String(worst.to.step_id) : null}
                      tipStyle={tipStyle}
                      tick={chart.tick}
                      grid={chart.grid}
                      accent={product.color}
                    />
                  </ChartCard>
                );
              })}
            </div>

            {segments.map((seg) => {
              const worst = worstHop(seg.hops);
              const worstTo = worst ? String(worst.to.step_id) : null;
              return (
              <ChartCard key={seg.title} title={`${seg.title} — where people leave`}>
                {worst && (
                  <p className="funnel-drop-callout">
                    Biggest leak: <strong>{fmtNumber(worst.dropped)}</strong> people ({pct(worst.dropRate)})
                    {' '}left between <strong>{String(worst.from.step_label)}</strong>
                    {' and '}
                    <strong>{String(worst.to.step_label)}</strong>
                  </p>
                )}
                <div className="core-path-strip">
                  {seg.steps.map((r, i) => {
                    const largest = worstTo != null && String(r.step_id) === worstTo;
                    return (
                      <span
                        key={String(r.step_id)}
                        className={`core-path-chip${largest ? ' largest-drop' : ''}`}
                      >
                        {i > 0 && <span className="core-path-arrow">→</span>}
                        <span className="core-path-label">{String(r.step_label)}</span>
                        <span className="core-path-users">{fmtNumber(num(r.users))}</span>
                      </span>
                    );
                  })}
                </div>

                <div className="funnel-split-pane">
                  <h4 className="flow-segment-title">People lost between screens</h4>
                  <HopDropChart
                    hops={seg.hops}
                    worst={worst}
                    tipStyle={tipStyle}
                    tick={chart.tick}
                    grid={chart.grid}
                  />
                </div>

                <FlowTable hops={seg.hops} worst={worst} />
              </ChartCard>
              );
            })}

            <ChartCard title="Every screen in detail">
              <p className="funnel-note" style={{ marginTop: 0 }}>
                <strong>People</strong> = distinct people. <strong>Once</strong> / <strong>Again</strong> split
                those people into one-timers vs people who came back to the screen.
                <strong>Times this happened</strong> = total taps. <strong>Times / person</strong> = taps ÷ people.

              </p>
              <div className="table-wrap funnel-table">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Screen</th>
                      <th>What the app logged</th>
                      <th>People</th>
                      <th>Once</th>
                      <th>Again (2+)</th>
                      <th>Times this happened</th>
                      <th>Times / person</th>
                      <th>Continued from last main step</th>
                      <th>Did not continue</th>
                      <th>Share who left</th>
                      <th>Share of people who used the app</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const drop = isTrue(r.is_drop);
                      const core = isTrue(r.is_core);
                      const largest = overallWorstToId != null && String(r.step_id) === overallWorstToId;
                      return (
                        <tr
                          key={String(r.step_id)}
                          className={
                            largest
                              ? 'row-largest-drop'
                              : drop
                                ? 'row-drop'
                                : core
                                  ? 'row-core'
                                  : ''
                          }
                        >
                          <td>{String(r.step_order)}</td>
                          <td>
                            {String(r.step_label)}
                            {core ? <span className="badge">main step</span> : null}
                            {drop ? <span className="badge danger">failed / blocked</span> : null}
                            {largest ? <span className="badge danger">biggest leak</span> : null}
                          </td>
                          <td className="mono muted events-cell" title={String(r.event_names || '')}>
                            {String(r.event_names || '')}
                          </td>
                          <td>{fmtNumber(num(r.users))}</td>
                          <td>{fmtNumber(num(r.once_users))}</td>
                          <td>{fmtNumber(num(r.repeat_users))}</td>
                          <td>{fmtNumber(num(r.hits))}</td>
                          <td>{num(r.hits_per_user) ? num(r.hits_per_user).toFixed(2) : '—'}</td>
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
