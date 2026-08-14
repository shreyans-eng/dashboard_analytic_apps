-- =============================================================================
-- Coinzy MVP #10 — Marketplace + Feed funnel (detailed steps + drop-off)
-- Events from CoinzyAndroid MarketPlaceScreen / AddForSaleScreen /
-- MarketDetailsScreen / CoinDetailsScreen / FeedScreen / BottomNavigationBar
-- Note: app uses marketplace_screen / market_item_expolre (typo) — NOT Marketplace_open
-- Contact is market_contact / market_contact_button — NOT contact_seller
-- =============================================================================

WITH bounds AS (
  SELECT
    FORMAT_DATE('%Y%m%d', {{start_date}}) AS start_s,
    FORMAT_DATE('%Y%m%d', {{end_date}}) AS end_s
),
base AS (
  SELECT
    COALESCE(
      user_id,
      (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'user_id'),
      user_pseudo_id
    ) AS resolved_user_id,
    REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS event_name_base
  FROM `{PROJECT}.{DATASET}.events_*`, bounds
  WHERE _TABLE_SUFFIX BETWEEN start_s AND end_s
    AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
    [[AND event_country = {{country}}]]
    [[AND event_platform = {{platform}}]]
),
dau AS (
  SELECT COUNT(DISTINCT resolved_user_id) AS dau FROM base
),
step_users AS (
  SELECT 'M01_tab' AS step_id, 'Marketplace: bottom nav' AS step_label, 1 AS step_order,
    COUNT(DISTINCT CASE WHEN event_name_base IN ('marketplace_bottom_nav', 'Marketplace_bottom_nav') THEN resolved_user_id END) AS users,
    COUNTIF(event_name_base IN ('marketplace_bottom_nav', 'Marketplace_bottom_nav')) AS events
  FROM base
  UNION ALL
  SELECT 'M02_screen', 'Marketplace: screen open', 2,
    COUNT(DISTINCT CASE WHEN event_name_base = 'marketplace_screen' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'marketplace_screen')
  FROM base
  UNION ALL
  SELECT 'M03_item', 'Marketplace: listing tap (market_item_expolre)', 3,
    COUNT(DISTINCT CASE WHEN event_name_base = 'market_item_expolre' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'market_item_expolre')
  FROM base
  UNION ALL
  SELECT 'M04_detail', 'Marketplace: sale details screen', 4,
    COUNT(DISTINCT CASE WHEN event_name_base = 'sale_Details_screen' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'sale_Details_screen')
  FROM base
  UNION ALL
  SELECT 'M05_contact', 'Marketplace: contact seller', 5,
    COUNT(DISTINCT CASE WHEN event_name_base IN ('market_contact', 'market_contact_button') THEN resolved_user_id END),
    COUNTIF(event_name_base IN ('market_contact', 'market_contact_button'))
  FROM base
  UNION ALL
  SELECT 'M06_sell_cta', 'Marketplace: add-for-sale CTA', 6,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'add_for_sale_button_marketplace',
      'add_for_sale_details_screen_button',
      'add_for_sale_owned_item_button'
    ) THEN resolved_user_id END),
    COUNTIF(event_name_base IN (
      'add_for_sale_button_marketplace',
      'add_for_sale_details_screen_button',
      'add_for_sale_owned_item_button'
    ))
  FROM base
  UNION ALL
  SELECT 'M07_listing_created', 'Marketplace: listing published', 7,
    COUNT(DISTINCT CASE WHEN event_name_base = 'market_add' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'market_add')
  FROM base
  UNION ALL
  SELECT 'M08_filter', 'Marketplace: filter used', 8,
    COUNT(DISTINCT CASE WHEN event_name_base IN ('filter_market', 'filter_field_market') THEN resolved_user_id END),
    COUNTIF(event_name_base IN ('filter_market', 'filter_field_market'))
  FROM base
  UNION ALL
  SELECT 'F01_tab', 'Feed: bottom nav', 9,
    COUNT(DISTINCT CASE WHEN event_name_base = 'feed_bottom_nav' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'feed_bottom_nav')
  FROM base
  UNION ALL
  SELECT 'F02_screen', 'Feed: screen open', 10,
    COUNT(DISTINCT CASE WHEN event_name_base = 'Feed_screen' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'Feed_screen')
  FROM base
  UNION ALL
  SELECT 'F03_engage', 'Feed: like or comment', 11,
    COUNT(DISTINCT CASE WHEN event_name_base IN ('feed_like', 'feed_comment') THEN resolved_user_id END),
    COUNTIF(event_name_base IN ('feed_like', 'feed_comment'))
  FROM base
  UNION ALL
  SELECT 'F04_post', 'Feed: create post', 12,
    COUNT(DISTINCT CASE WHEN event_name_base = 'feed_add' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'feed_add')
  FROM base
  UNION ALL
  SELECT 'K01_market_or_feed', 'KPI engage: marketplace_screen ∪ Feed_screen', 13,
    COUNT(DISTINCT CASE WHEN event_name_base IN ('marketplace_screen', 'Feed_screen') THEN resolved_user_id END),
    COUNTIF(event_name_base IN ('marketplace_screen', 'Feed_screen'))
  FROM base
)
SELECT
  s.step_order,
  s.step_id,
  s.step_label,
  s.users,
  s.events,
  d.dau,
  SAFE_DIVIDE(s.users, d.dau) AS pct_of_dau,
  LAG(s.users) OVER (ORDER BY s.step_order) AS prev_step_users,
  SAFE_DIVIDE(s.users, LAG(s.users) OVER (ORDER BY s.step_order)) AS pct_of_previous_step,
  1 - SAFE_DIVIDE(s.users, LAG(s.users) OVER (ORDER BY s.step_order)) AS drop_off_from_previous
FROM step_users s
CROSS JOIN dau d
ORDER BY s.step_order;
