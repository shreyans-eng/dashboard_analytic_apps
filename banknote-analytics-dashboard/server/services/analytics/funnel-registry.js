/**
 * Product funnel step mappings — verified from app code + BigQuery only.
 * Do not add events without evidence. Empty product mapping → insufficient instrumentation.
 */

/** @typedef {{ id: string, label: string, events: string[], isDrop?: boolean, core?: boolean }} FunnelStep */
/** @typedef {{ id: string, title: string, description: string, products: Record<string, FunnelStep[]> }} FunnelDef */

/** Banknote Identify — from Banknote-ai-identification/src/util/analytics.ts */
const BANKNOTE_IDENTIFY = [
  {
    id: 'entry',
    label: 'Identify entry (nav ∪ home)',
    events: ['Identify_bottom_nav', 'Identify_home'],
    core: true,
  },
  {
    id: 'camera',
    label: 'Camera / photo screen',
    events: ['Identification_screen', 'photo_screen'],
    core: true,
  },
  {
    id: 'permission_popup',
    label: 'Camera permission popup',
    events: ['Camera_permission_popup'],
  },
  {
    id: 'permission_granted',
    label: 'Camera permission granted',
    events: ['camera_permission_granted'],
  },
  {
    id: 'permission_denied',
    label: 'Camera permission denied',
    events: ['camer_permission_denied', 'camera_permission_denied'],
    isDrop: true,
  },
  {
    id: 'photo',
    label: 'Photo click / gallery upload',
    events: ['photo_clicked_1', 'photo_clicked_2', 'Photo_clicked', 'photo_uploaded_1', 'photo_uploaded_2'],
    core: true,
  },
  {
    id: 'crop',
    label: 'Crop screen',
    events: ['photo_cropping_screen_1', 'photo_cropping_screen_2'],
    core: true,
  },
  {
    id: 'crop_confirm',
    label: 'Crop confirmed',
    events: ['photo_crop_tick_1', 'photo_crop_tick_2'],
  },
  {
    id: 'submit',
    label: 'Submit photos',
    events: ['photo_submit_button', 'photos_submitted'],
    core: true,
  },
  {
    id: 'quota_block',
    label: 'Quota / limit block',
    events: ['Identified_limit_reached', 'identiifcation_limit_exceeded', 'scan_quota_exhausted'],
    isDrop: true,
  },
  {
    id: 'success',
    label: 'Identification success',
    events: ['identification_done_success', 'Identification_done_success'],
    core: true,
  },
  {
    id: 'failure',
    label: 'Identification failure',
    events: ['identification_done_failure', 'Identification_done_failure'],
    isDrop: true,
  },
  {
    id: 'top_matches',
    label: 'Top matches screen',
    events: ['identification_top5_matches'],
  },
  {
    id: 'option_chosen',
    label: 'Option chosen',
    events: ['idetnification_option_chosen', 'identification_option_chosen'],
  },
  {
    id: 'details',
    label: 'ID / banknote details',
    events: ['identification_details_screen', 'banknote_details_identification'],
  },
  {
    id: 'add_collection',
    label: 'Add to collection after ID',
    events: ['Added_to_collection_identified', 'Added_to_collection_owned'],
  },
];

/**
 * Coinzy Identify — verified from CoinzyAndroid:
 * CameraScreen.kt, IdentifyViewModel.kt, CoinAnalysisScreen.kt, CoinMatchScreen.kt,
 * HomeScreen.kt, BottomNavigationBar.kt, FreeScanLimitUtil.kt
 */
const COINZY_IDENTIFY = [
  {
    id: 'entry',
    label: 'Identify entry (nav ∪ home)',
    events: ['Identify_bottom_nav', 'Identify_home'],
    core: true,
  },
  {
    id: 'camera',
    label: 'Camera / photo screen',
    events: ['Identification_screen', 'photo_screen'],
    core: true,
  },
  {
    id: 'permission_popup',
    label: 'Camera permission popup',
    events: ['Camera_permission_popup'],
  },
  {
    id: 'permission_granted',
    label: 'Camera permission granted',
    events: ['camera_permission_granted'],
  },
  {
    id: 'permission_denied',
    label: 'Camera permission denied',
    events: ['camera_permission_denied'],
    isDrop: true,
  },
  {
    id: 'photo',
    label: 'Photo click / capture',
    events: ['photo_clicked_1', 'photo_clicked_2', 'Photo_clicked'],
    core: true,
  },
  {
    id: 'crop',
    label: 'Crop screen',
    events: ['photo_cropping_screen_0', 'photo_cropping_screen_1', 'photo_cropping_screen_2'],
    core: true,
  },
  {
    id: 'crop_confirm',
    label: 'Crop confirmed',
    events: ['photo_crop_tick_0', 'photo_crop_tick_1', 'photo_crop_tick_2'],
  },
  {
    id: 'submit',
    label: 'Submit photos',
    events: ['photo_submit_button', 'photos_submitted', 'Identification_done'],
    core: true,
  },
  {
    id: 'quota_block',
    label: 'Quota / limit block',
    events: [
      'Identified_limit_reached',
      'free_scan_limit_exceeded',
      'free_scan_blocked',
      'free_scan_success_quota_exhausted',
      'Identification_unsuccessful_limit_reached',
      'Collection_limit_Reached',
    ],
    isDrop: true,
  },
  {
    id: 'success',
    label: 'Identification success',
    events: ['identification_done_success', 'Identification_done_success'],
    core: true,
  },
  {
    id: 'failure',
    label: 'Identification failure',
    events: [
      'identification_done_failure',
      'Identification_done_failure',
      'Identification_failed',
      'Identification_unsuccessful',
    ],
    isDrop: true,
  },
  {
    id: 'all_options',
    label: 'All options / multi-coin match',
    events: ['identification_all_options_screen'],
  },
  {
    id: 'option_chosen',
    label: 'Option chosen (typo event name in app)',
    events: ['idetnification_option_chosen', 'identification_option_chosen'],
  },
  {
    id: 'details',
    label: 'ID / coin details after ID',
    events: ['identification_details_screen', 'Coin_details_identification'],
  },
  {
    id: 'add_collection',
    label: 'Add to collection after ID',
    events: [
      'Added_to_collection_identified',
      'Added_to_collection_owned',
      'Added _to_collection_owned',
    ],
  },
];

const BANKNOTE_CATALOGUE = [
  {
    id: 'collection_tab',
    label: 'Collection bottom nav',
    events: ['private_collection_bottom_nav'],
  },
  {
    id: 'collection_screen',
    label: 'Collection screen',
    events: ['Collection_screen'],
    core: true,
  },
  {
    id: 'collection_clicked',
    label: 'Open collection card',
    events: ['Collection_clicked'],
    core: true,
  },
  {
    id: 'sub_collection',
    label: 'Sub-collection screen',
    events: ['Sub_collection_Screen'],
    core: true,
  },
  {
    id: 'sub_item',
    label: 'Sub-collection item tap',
    events: ['sub_collection_item'],
  },
  {
    id: 'details_collection',
    label: 'Details from collection',
    events: ['banknote_details_collection'],
    core: true,
  },
  {
    id: 'global_cta',
    label: 'Global catalogue CTA',
    events: ['Global_catalogue', 'View_all_button_global'],
  },
  {
    id: 'global_screen',
    label: 'Global catalogue screen',
    events: ['Global_catalogue_screen'],
    core: true,
  },
  {
    id: 'global_item',
    label: 'Global catalogue item',
    events: ['global_catalogue_item'],
    core: true,
  },
  {
    id: 'details_global',
    label: 'Details from global',
    events: ['banknote_details_global'],
    core: true,
  },
  {
    id: 'open_kpi',
    label: 'Catalogue open (KPI union)',
    events: [
      'Collection_screen',
      'Global_catalogue_screen',
      'Collection_open',
      'collection_open',
      'Collection',
      'My_collection',
    ],
  },
];

/**
 * Coinzy catalogue — verified from CoinzyAndroid:
 * CollectionScreen.kt, CollectionGrid.kt, WorldCollectionScreen.kt,
 * OwnedCollectionScreen.kt, CoinDetailsScreen.kt, HomeScreen.kt, BottomNavigationBar.kt
 * Bottom nav fires `{route}_bottom_nav` → collection_bottom_nav
 */
const COINZY_CATALOGUE = [
  {
    id: 'collection_tab',
    label: 'Collection bottom nav',
    events: ['collection_bottom_nav'],
  },
  {
    id: 'collection_screen',
    label: 'Collection screen',
    events: ['Collection_screen'],
    core: true,
  },
  {
    id: 'collection_clicked',
    label: 'Open collection card',
    events: ['Collection_clicked'],
    core: true,
  },
  {
    id: 'sub_collection',
    label: 'Sub-collection screen',
    events: ['Sub_collection_Screen'],
    core: true,
  },
  {
    id: 'sub_item',
    label: 'Sub-collection item tap',
    events: ['sub_collection_item'],
  },
  {
    id: 'details_collection',
    label: 'Coin details from collection',
    events: ['Coin_details_collection', 'Coin_details'],
    core: true,
  },
  {
    id: 'global_cta',
    label: 'Global catalogue CTA',
    events: ['Global_catalogue'],
  },
  {
    id: 'global_screen',
    label: 'Global catalogue screen',
    events: ['Global_catalogue_screen'],
    core: true,
  },
  {
    id: 'global_item',
    label: 'Global catalogue item',
    events: ['global_catalogue_item'],
    core: true,
  },
  {
    id: 'details_global',
    label: 'Coin details from global',
    events: ['Coin_details_global'],
    core: true,
  },
  {
    id: 'open_kpi',
    label: 'Catalogue open (KPI union)',
    events: ['Collection_screen', 'Global_catalogue_screen'],
    core: true,
  },
];

const BANKNOTE_MARKETPLACE = [
  {
    id: 'market_tab',
    label: 'Marketplace bottom nav',
    events: ['Marketplace_bottom_nav', 'marketplace_bottom_nav'],
    core: true,
  },
  {
    id: 'market_screen',
    label: 'Marketplace screen',
    events: ['marketplace_screen'],
    core: true,
  },
  {
    id: 'market_item',
    label: 'Listing tap (market_item_expolre)',
    events: ['market_item_expolre'],
    core: true,
  },
  {
    id: 'sale_details',
    label: 'Sale details screen',
    events: ['sale_Details_screen'],
    core: true,
  },
  {
    id: 'contact',
    label: 'Contact seller',
    events: ['market_contact', 'market_contact_button'],
    core: true,
  },
  {
    id: 'sell_cta',
    label: 'Add for sale CTA',
    events: ['add_for_sale_button_marketplace', 'add_for_sale_details_scr_btn'],
  },
  {
    id: 'listing_created',
    label: 'Listing published',
    events: ['market_add', 'market_contact_Add_for_sale'],
  },
  {
    id: 'feed_tab',
    label: 'Feed bottom nav',
    events: ['feed_bottom_nav'],
  },
  {
    id: 'feed_screen',
    label: 'Feed screen',
    events: ['Feed_screen'],
    core: true,
  },
  {
    id: 'feed_engage',
    label: 'Feed like / comment',
    events: ['feed_like', 'feed_comment'],
  },
  {
    id: 'feed_post',
    label: 'Feed create post',
    events: ['feed_add', 'feed_post'],
  },
];

/**
 * Coinzy Marketplace + Feed — verified from CoinzyAndroid:
 * MarketPlaceScreen.kt, AddForSaleScreen.kt, MarketDetailsScreen.kt,
 * CoinDetailsScreen.kt, FeedScreen.kt, CommunityViewModel.kt, BottomNavigationBar.kt
 * Note: app uses market_item_expolre (typo) — NOT Marketplace_open / contact_seller
 */
const COINZY_MARKETPLACE = [
  {
    id: 'market_tab',
    label: 'Marketplace bottom nav',
    events: ['marketplace_bottom_nav', 'Marketplace_bottom_nav'],
    core: true,
  },
  {
    id: 'market_screen',
    label: 'Marketplace screen',
    events: ['marketplace_screen'],
    core: true,
  },
  {
    id: 'market_item',
    label: 'Listing tap (market_item_expolre)',
    events: ['market_item_expolre'],
    core: true,
  },
  {
    id: 'sale_details',
    label: 'Sale details screen',
    events: ['sale_Details_screen'],
    core: true,
  },
  {
    id: 'contact',
    label: 'Contact seller',
    events: ['market_contact', 'market_contact_button'],
    core: true,
  },
  {
    id: 'sell_cta',
    label: 'Add for sale CTA',
    events: [
      'add_for_sale_button_marketplace',
      'add_for_sale_details_screen_button',
      'add_for_sale_owned_item_button',
    ],
  },
  {
    id: 'listing_created',
    label: 'Listing published',
    events: ['market_add'],
  },
  {
    id: 'feed_tab',
    label: 'Feed bottom nav',
    events: ['feed_bottom_nav'],
  },
  {
    id: 'feed_screen',
    label: 'Feed screen',
    events: ['Feed_screen'],
    core: true,
  },
  {
    id: 'feed_engage',
    label: 'Feed like / comment',
    events: ['feed_like', 'feed_comment'],
  },
  {
    id: 'feed_post',
    label: 'Feed create post',
    events: ['feed_add'],
  },
];

/** Paywall — Banknote uses Subs_confirm; Coinzy Android fires lowercase subs_confirm */
const BANKNOTE_PAYWALL = [
  {
    id: 'paywall',
    label: 'Paywall (Subs_page)',
    events: ['Subs_page', 'Subs_page_discount', 'Subscription_screen', 'Subs_page_onboarding'],
    core: true,
  },
  {
    id: 'confirm',
    label: 'Purchase confirm (Subs_confirm)',
    events: ['Subs_confirm'],
    core: true,
  },
  {
    id: 'cancel',
    label: 'Subs cancel',
    events: ['subs_cancel', 'Subs_cancel'],
    isDrop: true,
  },
];

/**
 * Coinzy paywall — verified from CoinzyAndroid BillingViewModel.kt + SubscriptionDialog.kt
 * Confirm is lowercase `subs_confirm` (not Subs_confirm). Pack click is `subs_pack`.
 */
const COINZY_PAYWALL = [
  {
    id: 'paywall',
    label: 'Paywall (Subs_page)',
    events: ['Subs_page', 'Subs_page_discount', 'Subscription_screen', 'Subs_page_onboarding'],
    core: true,
  },
  {
    id: 'pack',
    label: 'Pack click',
    events: ['subs_pack', 'subs_pack_discount', 'subs_button'],
  },
  {
    id: 'confirm',
    label: 'Purchase confirm (subs_confirm)',
    events: ['subs_confirm', 'subs_confirm_discount', 'Subs_confirm', 'paid_purchase', 'trial_purchase'],
    core: true,
  },
  {
    id: 'cancel',
    label: 'Subs cancel',
    events: ['subs_cancel', 'Subs_cancel'],
    isDrop: true,
  },
  {
    id: 'fail',
    label: 'Subs fail',
    events: ['subs_fail', 'Subs_fail'],
    isDrop: true,
  },
];

/** @type {Record<string, FunnelDef>} */
export const FUNNELS = {
  identify: {
    id: 'identify',
    title: 'Identify funnel',
    description: 'Entry → camera → photo → crop → submit → success/failure → details',
    products: {
      banknote: BANKNOTE_IDENTIFY,
      coinzy: COINZY_IDENTIFY,
    },
  },
  catalogue: {
    id: 'catalogue',
    title: 'Catalogue / Collection funnel',
    description: 'Private collection + global catalogue browse paths',
    products: {
      banknote: BANKNOTE_CATALOGUE,
      coinzy: COINZY_CATALOGUE,
    },
  },
  marketplace: {
    id: 'marketplace',
    title: 'Marketplace + Feed funnel',
    description: 'Marketplace listing path and Feed engagement',
    products: {
      banknote: BANKNOTE_MARKETPLACE,
      coinzy: COINZY_MARKETPLACE,
    },
  },
  paywall: {
    id: 'paywall',
    title: 'Paywall → purchase funnel',
    description: 'Subscription page impressions → confirm / cancel',
    products: {
      banknote: BANKNOTE_PAYWALL,
      coinzy: COINZY_PAYWALL,
    },
  },
};

export function listFunnels() {
  return Object.values(FUNNELS).map((f) => ({
    id: f.id,
    title: f.title,
    description: f.description,
    products: Object.keys(f.products),
  }));
}

export function getFunnelSteps(funnelId, productId) {
  const funnel = FUNNELS[funnelId];
  if (!funnel) return null;
  const steps = funnel.products[productId];
  if (!steps || !steps.length) {
    return {
      funnel,
      steps: [],
      status: 'insufficient_instrumentation',
      message: `No verified event mapping for ${funnelId} on ${productId}`,
    };
  }
  return { funnel, steps, status: 'ok', message: null };
}

export function sqlStringLiteral(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

/**
 * Cheap identity for interactive raw scans.
 * Skips UNNEST(event_params) so BigQuery does not bill the fat nested column.
 * Logged-in users still resolve via top-level user_id; everyone has user_pseudo_id.
 */
const CHEAP_USER = 'COALESCE(user_id, user_pseudo_id)';
const EVENT_BASE = `REGEXP_REPLACE(event_name, r'_(android|ios)$', '')`;

/**
 * One events_* scan (event_name + user_id + user_pseudo_id only).
 * Aggregates every step in a single SELECT so BigQuery cannot inline N copies of the CTE.
 */
export function buildFunnelSql(project, dataset, steps, startDate, endDate) {
  const startS = startDate.replace(/-/g, '');
  const endS = endDate.replace(/-/g, '');

  const aggCols = steps.map((step, i) => {
    const evList = step.events.map(sqlStringLiteral).join(', ');
    return `
    COUNT(DISTINCT IF(${EVENT_BASE} IN (${evList}), ${CHEAP_USER}, NULL)) AS users_${i},
    COUNTIF(${EVENT_BASE} IN (${evList})) AS hits_${i}`;
  }).join(',');

  const unpack = steps.map((step, i) => `
  SELECT
    ${i + 1} AS step_order,
    ${sqlStringLiteral(step.id)} AS step_id,
    ${sqlStringLiteral(step.label)} AS step_label,
    ${sqlStringLiteral(step.events.join(', '))} AS event_names,
    ${step.core ? 'TRUE' : 'FALSE'} AS is_core,
    ${step.isDrop ? 'TRUE' : 'FALSE'} AS is_drop,
    users_${i} AS users,
    hits_${i} AS hits,
    dau
  FROM agg`).join('\n  UNION ALL\n');

  return `
WITH agg AS (
  SELECT
    COUNT(DISTINCT ${CHEAP_USER}) AS dau,
    ${aggCols.trim()}
  FROM \`${project}.${dataset}.events_*\`
  WHERE _TABLE_SUFFIX BETWEEN '${startS}' AND '${endS}'
    AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\\d{8}$')
),
steps AS (
${unpack}
),
core_chain AS (
  SELECT
    step_id,
    users,
    LAG(users) OVER (ORDER BY step_order) AS prev_users
  FROM steps
  WHERE is_core AND NOT is_drop
)
SELECT
  s.step_order,
  s.step_id,
  s.step_label,
  s.event_names,
  s.is_core,
  s.is_drop,
  s.users,
  s.hits,
  s.dau,
  SAFE_DIVIDE(s.users, s.dau) AS pct_of_dau,
  SAFE_DIVIDE(s.hits, NULLIF(s.users, 0)) AS hits_per_user,
  c.prev_users,
  SAFE_DIVIDE(s.users, c.prev_users) AS pct_of_previous,
  CASE
    WHEN c.prev_users IS NULL THEN NULL
    ELSE GREATEST(0, c.prev_users - s.users)
  END AS drop_off_users,
  CASE
    WHEN c.prev_users IS NULL THEN NULL
    ELSE 1 - SAFE_DIVIDE(s.users, c.prev_users)
  END AS drop_off_rate
FROM steps s
LEFT JOIN core_chain c ON c.step_id = s.step_id
ORDER BY s.step_order
`.trim();
}

export function buildEventInventoryFromSummarySql(project, summaryDataset, startDate, endDate, search = '') {
  const searchFilter = search
    ? `AND LOWER(event_name_base) LIKE LOWER('%${String(search).replace(/'/g, "''")}%')`
    : '';
  return `
SELECT
  event_name_base AS event_name,
  SUM(event_count) AS hits,
  MAX(unique_users) AS unique_users,
  MIN(event_date) AS first_seen,
  MAX(event_date) AS last_seen,
  SAFE_DIVIDE(SUM(event_count), MAX(unique_users)) AS hits_per_user
FROM \`${project}.${summaryDataset}.top_events\`
WHERE event_date BETWEEN DATE '${startDate}' AND DATE '${endDate}'
  ${searchFilter}
GROUP BY event_name_base
ORDER BY hits DESC
LIMIT 500
`.trim();
}

export function buildEventInventorySql(project, dataset, startDate, endDate, search = '') {
  const startS = startDate.replace(/-/g, '');
  const endS = endDate.replace(/-/g, '');
  const searchFilter = search
    ? `AND LOWER(${EVENT_BASE}) LIKE LOWER('%${String(search).replace(/'/g, "''")}%')`
    : '';

  return `
SELECT
  ${EVENT_BASE} AS event_name,
  COUNT(*) AS hits,
  COUNT(DISTINCT ${CHEAP_USER}) AS unique_users,
  MIN(PARSE_DATE('%Y%m%d', event_date)) AS first_seen,
  MAX(PARSE_DATE('%Y%m%d', event_date)) AS last_seen,
  SAFE_DIVIDE(COUNT(*), COUNT(DISTINCT ${CHEAP_USER})) AS hits_per_user
FROM \`${project}.${dataset}.events_*\`
WHERE _TABLE_SUFFIX BETWEEN '${startS}' AND '${endS}'
  AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\\d{8}$')
  ${searchFilter}
GROUP BY event_name
ORDER BY hits DESC
LIMIT 500
`.trim();
}

/** Daily + range totals in one scan (ROLLUP). event_date IS NULL = range totals. */
export function buildEventDailySql(project, dataset, eventName, startDate, endDate) {
  const startS = startDate.replace(/-/g, '');
  const endS = endDate.replace(/-/g, '');
  const ev = sqlStringLiteral(eventName);

  return `
SELECT
  PARSE_DATE('%Y%m%d', event_date) AS event_date,
  COUNT(*) AS hits,
  COUNT(DISTINCT ${CHEAP_USER}) AS unique_users
FROM \`${project}.${dataset}.events_*\`
WHERE _TABLE_SUFFIX BETWEEN '${startS}' AND '${endS}'
  AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\\d{8}$')
  AND ${EVENT_BASE} = ${ev}
GROUP BY ROLLUP(event_date)
ORDER BY event_date
`.trim();
}

export function buildEventRangeTotalsSql(project, dataset, eventName, startDate, endDate) {
  return buildEventDailySql(project, dataset, eventName, startDate, endDate);
}

export function buildEventParamsSql(project, dataset, eventName, startDate, endDate) {
  const startS = startDate.replace(/-/g, '');
  const endS = endDate.replace(/-/g, '');
  const ev = sqlStringLiteral(eventName);

  return `
SELECT
  ep.key AS parameter_name,
  CASE
    WHEN ep.value.string_value IS NOT NULL THEN 'string'
    WHEN ep.value.int_value IS NOT NULL THEN 'int'
    WHEN ep.value.float_value IS NOT NULL THEN 'float'
    WHEN ep.value.double_value IS NOT NULL THEN 'double'
    ELSE 'other'
  END AS parameter_type,
  ANY_VALUE(COALESCE(
    ep.value.string_value,
    CAST(ep.value.int_value AS STRING),
    CAST(ep.value.float_value AS STRING),
    CAST(ep.value.double_value AS STRING)
  )) AS example_value,
  COUNT(*) AS occurrence_count
FROM \`${project}.${dataset}.events_*\` e, UNNEST(event_params) ep
WHERE _TABLE_SUFFIX BETWEEN '${startS}' AND '${endS}'
  AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\\d{8}$')
  AND REGEXP_REPLACE(e.event_name, r'_(android|ios)$', '') = ${ev}
  AND ep.key NOT IN ('user_id', 'user_pseudo_id', 'ga_session_id')
GROUP BY 1, 2
ORDER BY occurrence_count DESC
LIMIT 40
`.trim();
}
