-- =============================================================================
-- Coinzy MVP #9 — Catalogue / Collection funnel (detailed steps + drop-off)
-- Events from CoinzyAndroid CollectionScreen / WorldCollectionScreen /
-- CoinDetailsScreen / HomeScreen / BottomNavigationBar
-- Note: details are Coin_details_* (not banknote_details_*)
-- Bottom nav fires collection_bottom_nav from route "collection"
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
  SELECT '01_collection_tab' AS step_id, 'Entry: Collection bottom nav' AS step_label, 1 AS step_order,
    COUNT(DISTINCT CASE WHEN event_name_base = 'collection_bottom_nav' THEN resolved_user_id END) AS users,
    COUNTIF(event_name_base = 'collection_bottom_nav') AS events
  FROM base
  UNION ALL
  SELECT '02_collection_screen', 'Screen: Collection_screen (private)', 2,
    COUNT(DISTINCT CASE WHEN event_name_base = 'Collection_screen' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'Collection_screen')
  FROM base
  UNION ALL
  SELECT '03_collection_clicked', 'Open Owned/Wishlist/private card', 3,
    COUNT(DISTINCT CASE WHEN event_name_base = 'Collection_clicked' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'Collection_clicked')
  FROM base
  UNION ALL
  SELECT '04_sub_collection', 'Sub-collection list screen', 4,
    COUNT(DISTINCT CASE WHEN event_name_base = 'Sub_collection_Screen' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'Sub_collection_Screen')
  FROM base
  UNION ALL
  SELECT '05_sub_item', 'Tap item in sub-collection', 5,
    COUNT(DISTINCT CASE WHEN event_name_base = 'sub_collection_item' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'sub_collection_item')
  FROM base
  UNION ALL
  SELECT '06_details_collection', 'Coin details (from collection)', 6,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'Coin_details_collection', 'Coin_details'
    ) THEN resolved_user_id END),
    COUNTIF(event_name_base IN ('Coin_details_collection', 'Coin_details'))
  FROM base
  UNION ALL
  SELECT '07_filter_private', 'Filter (private collection)', 7,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'Filter_button_private', 'filter_field_selected_collection',
      'filter_sub_collection', 'Predefined_filter_private'
    ) THEN resolved_user_id END),
    COUNTIF(event_name_base IN (
      'Filter_button_private', 'filter_field_selected_collection',
      'filter_sub_collection', 'Predefined_filter_private'
    ))
  FROM base
  UNION ALL
  SELECT '08_global_cta', 'Entry: Global catalogue CTA (Home)', 8,
    COUNT(DISTINCT CASE WHEN event_name_base = 'Global_catalogue' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'Global_catalogue')
  FROM base
  UNION ALL
  SELECT '09_global_screen', 'Screen: Global_catalogue_screen', 9,
    COUNT(DISTINCT CASE WHEN event_name_base = 'Global_catalogue_screen' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'Global_catalogue_screen')
  FROM base
  UNION ALL
  SELECT '10_global_item', 'Tap item in global catalogue', 10,
    COUNT(DISTINCT CASE WHEN event_name_base = 'global_catalogue_item' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'global_catalogue_item')
  FROM base
  UNION ALL
  SELECT '11_details_global', 'Coin details (from global)', 11,
    COUNT(DISTINCT CASE WHEN event_name_base = 'Coin_details_global' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'Coin_details_global')
  FROM base
  UNION ALL
  SELECT '12_filter_global', 'Filter (global catalogue)', 12,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'Filter_button_global', 'Predefined_filter_global'
    ) THEN resolved_user_id END),
    COUNTIF(event_name_base IN (
      'Filter_button_global', 'Predefined_filter_global'
    ))
  FROM base
  UNION ALL
  SELECT '13_catalogue_open_any', 'KPI open: Collection_screen ∪ Global_catalogue_screen', 13,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'Collection_screen', 'Global_catalogue_screen'
    ) THEN resolved_user_id END),
    COUNTIF(event_name_base IN ('Collection_screen', 'Global_catalogue_screen'))
  FROM base
  UNION ALL
  SELECT '14_wishlist_add', 'Added to wishlist', 14,
    COUNT(DISTINCT CASE WHEN event_name_base = 'add_to_wishlist' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'add_to_wishlist')
  FROM base
  UNION ALL
  SELECT '15_collection_limit', 'Collection limit reached (drop)', 15,
    COUNT(DISTINCT CASE WHEN event_name_base = 'Collection_limit_Reached' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'Collection_limit_Reached')
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
