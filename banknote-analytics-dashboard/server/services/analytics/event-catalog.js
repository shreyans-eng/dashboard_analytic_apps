/**
 * Catalog of Firebase events the dashboard actually maps, per app.
 * Built from funnel-registry + DAU / KPI extras — not live BigQuery inventory.
 */

import { DAU_EVENT_BASES, NOTIFICATION_EVENT_BASES } from './dau-definition.js';
import { FUNNELS, getFunnelSteps } from './funnel-registry.js';

const PRODUCTS = ['banknote', 'coinzy'];
const PRODUCT_LABEL = { banknote: 'Banknote', coinzy: 'Coinzy' };

function push(rows, seen, row) {
  const key = [row.product, row.event, row.surface, row.tab, row.step, row.role].join('\t');
  if (seen.has(key)) return;
  seen.add(key);
  rows.push(row);
}

function addEvents(rows, seen, { products, events, surface, tab, step, role }) {
  for (const product of products) {
    for (const event of events) {
      if (!event) continue;
      push(rows, seen, {
        product,
        app: PRODUCT_LABEL[product],
        event,
        surface,
        tab,
        step,
        role,
      });
    }
  }
}

function collectFunnelRows(rows, seen) {
  for (const product of PRODUCTS) {
    for (const funnel of Object.values(FUNNELS)) {
      const mapped = getFunnelSteps(funnel.id, product);
      if (!mapped || mapped.status !== 'ok') continue;
      const surface = `Funnel · ${funnel.title}`;
      for (const step of mapped.steps) {
        const role = step.isDrop ? 'drop' : step.core ? 'core' : 'side';
        addEvents(rows, seen, {
          products: [product],
          events: step.events || [],
          surface,
          tab: funnel.id,
          step: step.label,
          role,
        });
        addEvents(rows, seen, {
          products: [product],
          events: step.excludeEvents || [],
          surface,
          tab: funnel.id,
          step: `${step.label} (exclude)`,
          role: 'exclude',
        });
      }
      addEvents(rows, seen, {
        products: [product],
        events: mapped.cohortEvents || [],
        surface,
        tab: funnel.id,
        step: 'Cohort filter',
        role: 'cohort',
      });
      addEvents(rows, seen, {
        products: [product],
        events: mapped.cohortExcludeEvents || [],
        surface,
        tab: funnel.id,
        step: 'Cohort exclude',
        role: 'cohort-exclude',
      });
      if (mapped.packMix) {
        addEvents(rows, seen, {
          products: [product],
          events: mapped.packMix.packEvents || [],
          surface,
          tab: funnel.id,
          step: 'Pack mix',
          role: 'pack',
        });
        addEvents(rows, seen, {
          products: [product],
          events: mapped.packMix.confirmEvents || [],
          surface,
          tab: funnel.id,
          step: 'Pack mix confirm',
          role: 'pack',
        });
      }
    }
  }
}

function collectKpiRows(rows, seen) {
  addEvents(rows, seen, {
    products: PRODUCTS,
    events: [...DAU_EVENT_BASES],
    surface: 'KPI · DAU',
    tab: 'mvp.dau',
    step: 'Opened the app',
    role: 'kpi',
  });
  addEvents(rows, seen, {
    products: PRODUCTS,
    events: ['first_open'],
    surface: 'KPI · Installs',
    tab: 'mvp.time-to-first-scan',
    step: 'Install / new users / LTV cohort',
    role: 'kpi',
  });
  addEvents(rows, seen, {
    products: PRODUCTS,
    events: ['identification_done_success', 'Identification_done_success'],
    surface: 'KPI · Identify success',
    tab: 'mvp.identify-success',
    step: 'Successful ID',
    role: 'kpi',
  });
  addEvents(rows, seen, {
    products: ['coinzy'],
    events: ['Identification_done'],
    surface: 'KPI · Identify success',
    tab: 'mvp.identify-success',
    step: 'Successful ID (Coinzy alias)',
    role: 'kpi',
  });
  addEvents(rows, seen, {
    products: PRODUCTS,
    events: ['identification_done_failure', 'Identification_done_failure'],
    surface: 'KPI · Identify success',
    tab: 'mvp.identify-success',
    step: 'Failed ID',
    role: 'kpi',
  });
  addEvents(rows, seen, {
    products: ['coinzy'],
    events: ['Identification_failed'],
    surface: 'KPI · Identify success',
    tab: 'mvp.identify-success',
    step: 'Failed ID',
    role: 'kpi',
  });
  addEvents(rows, seen, {
    products: ['banknote'],
    events: ['identiifcation_limit_exceeded', 'Identified_limit_reached', 'scan_quota_exhausted'],
    surface: 'KPI · Quota',
    tab: 'mvp.quota-hit',
    step: 'Scan quota hit',
    role: 'kpi',
  });
  addEvents(rows, seen, {
    products: ['coinzy'],
    events: [
      'Identified_limit_reached',
      'free_scan_limit_exceeded',
      'free_scan_blocked',
      'free_scan_success_quota_exhausted',
      'free_scan_fail_quota_exhausted',
      'free_scan_success_consumed',
      'free_scan_go_premium_tapped',
      'free_scan_not_now_tapped',
      'free_scan_quota_reset',
    ],
    surface: 'KPI · Quota',
    tab: 'mvp.quota-hit',
    step: 'Scan / free-scan quota',
    role: 'kpi',
  });
  addEvents(rows, seen, {
    products: PRODUCTS,
    events: ['Subs_page', 'Subs_page_discount', 'Subscription_screen'],
    surface: 'KPI · Paywall',
    tab: 'mvp.paywall',
    step: 'Paywall impression (event counts)',
    role: 'kpi',
  });
  addEvents(rows, seen, {
    products: ['banknote'],
    events: ['Subs_confirm'],
    surface: 'KPI · Paywall',
    tab: 'mvp.paywall',
    step: 'Confirm (event counts)',
    role: 'kpi',
  });
  addEvents(rows, seen, {
    products: ['coinzy'],
    events: ['subs_confirm', 'subs_confirm_discount', 'paid_purchase', 'trial_purchase'],
    surface: 'KPI · Paywall',
    tab: 'mvp.paywall',
    step: 'Confirm (event counts)',
    role: 'kpi',
  });
  addEvents(rows, seen, {
    products: PRODUCTS,
    events: ['user_engagement'],
    surface: 'Explorer · Time used',
    tab: 'explorer.install-day-usage',
    step: 'Engagement time',
    role: 'kpi',
  });
  addEvents(rows, seen, {
    products: PRODUCTS,
    events: ['in_app_purchase', 'purchase'],
    surface: 'Explorer · LTV',
    tab: 'explorer.ltv',
    step: 'Store revenue (not Subs_confirm)',
    role: 'kpi',
  });
  addEvents(rows, seen, {
    products: PRODUCTS,
    events: [...NOTIFICATION_EVENT_BASES],
    surface: 'Explorer · Notifications',
    tab: 'explorer.dau',
    step: 'Push (not app-open DAU)',
    role: 'kpi',
  });
}

export function uniqueEventRows(usages) {
  const map = new Map();
  for (const row of usages) {
    const key = `${row.product}\t${row.event}`;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        product: row.product,
        app: row.app,
        event: row.event,
        surfaces: [],
        roles: [],
        tabs: [],
      };
      map.set(key, entry);
    }
    if (!entry.surfaces.includes(row.surface)) entry.surfaces.push(row.surface);
    if (!entry.roles.includes(row.role)) entry.roles.push(row.role);
    if (row.tab && !entry.tabs.includes(row.tab)) entry.tabs.push(row.tab);
  }
  return [...map.values()]
    .map((e) => ({
      ...e,
      used_in: e.surfaces.join(' · '),
      roles_label: e.roles.join(', '),
    }))
    .sort((a, b) => a.app.localeCompare(b.app) || a.event.localeCompare(b.event));
}

export function catalogSummary(unique) {
  const banknote = unique.filter((r) => r.product === 'banknote').map((r) => r.event);
  const coinzy = unique.filter((r) => r.product === 'coinzy').map((r) => r.event);
  const bn = new Set(banknote);
  const cz = new Set(coinzy);
  let shared = 0;
  for (const e of bn) if (cz.has(e)) shared += 1;
  return {
    banknote: bn.size,
    coinzy: cz.size,
    shared,
    totalUsages: 0,
  };
}

export function listEventCatalog() {
  const usages = [];
  const seen = new Set();
  collectFunnelRows(usages, seen);
  collectKpiRows(usages, seen);
  usages.sort((a, b) => a.app.localeCompare(b.app) || a.event.localeCompare(b.event) || a.surface.localeCompare(b.surface));
  const unique = uniqueEventRows(usages);
  const summary = catalogSummary(unique);
  summary.totalUsages = usages.length;
  return { usages, unique, summary };
}
