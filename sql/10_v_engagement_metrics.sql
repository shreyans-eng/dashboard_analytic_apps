-- =============================================================================
-- v_engagement_metrics
-- Daily engagement intensity + collection / marketplace / feed loops.
-- Metrics: #15 scans/user, #16 collection add after ID, #17 catalogue,
--          #18 marketplace & feed, #20 session length + feature mix
-- Depends on: v_events_normalized, v_daily_active_users
-- =============================================================================

CREATE OR REPLACE VIEW `{PROJECT}.{DATASET}.v_engagement_metrics` AS

WITH user_scans AS (
  SELECT
    event_date,
    platform,
    country,
    resolved_user_id,
    SUM(identifications) AS identifications,
    SUM(identifications_success) AS scans
  FROM `{PROJECT}.{DATASET}.v_daily_active_users`
  GROUP BY event_date, platform, country, resolved_user_id
),

dau AS (
  SELECT
    event_date,
    platform,
    country,
    COUNT(*) AS dau,
    SUM(identifications) AS total_identifications,
    SUM(scans) AS total_success_scans,
    COUNTIF(scans > 0) AS users_with_scan,
    APPROX_QUANTILES(IF(scans > 0, scans, NULL), 100) AS scan_q
  FROM user_scans
  GROUP BY event_date, platform, country
),

user_day_flags AS (
  SELECT
    event_date,
    platform,
    country,
    resolved_user_id,
    MAX(IF(event_name_base IN (
      'identification_done_success', 'Identification_done_success'
    ), 1, 0)) AS had_success_id,
    MAX(IF(
      STARTS_WITH(event_name_base, 'Added_to_collection')
      OR event_name_base IN (
        'Added_to_collection', 'add_to_collection',
        'Collection_add', 'collection_item_added',
        'Added _to_collection_owned', 'add_to_wishlist'
      ), 1, 0)) AS added_to_collection,
    MAX(IF(event_name_base IN (
      'Collection_screen',
      'collection_bottom_nav', 'private_collection_bottom_nav'
    ), 1, 0)) AS opened_private_collection,
    MAX(IF(event_name_base IN (
      'Global_catalogue_screen', 'Global_catalogue'
    ), 1, 0)) AS opened_global_catalogue,
    MAX(IF(event_name_base IN (
      'Collection_screen', 'Global_catalogue_screen',
      'collection_bottom_nav', 'private_collection_bottom_nav'
    ), 1, 0)) AS opened_collection,
    MAX(IF(event_name_base IN (
      'Collection_detail', 'collection_detail', 'banknote_detail',
      'coin_detail', 'Catalogue_detail', 'note_detail_view',
      'Coin_details', 'Coin_details_collection', 'Coin_details_global',
      'Coin_details_identification', 'identification_details_screen',
      'banknote_details_collection', 'banknote_details_global',
      'banknote_details_identification'
    ), 1, 0)) AS viewed_detail,
    MAX(IF(
      event_name_base IN (
        'Collection_filter', 'filter_applied', 'Filter_applied',
        'Filter_button_private', 'Filter_button_global',
        'filter_field_selected_collection', 'filter_sub_collection',
        'Predefined_filter_private', 'Predefined_filter_global'
      )
      OR filter_name IS NOT NULL,
      1, 0
    )) AS used_filter,
    MAX(IF(event_name_base IN (
      'marketplace_screen', 'Marketplace_bottom_nav', 'marketplace_bottom_nav',
      'market_item_expolre'
    ), 1, 0)) AS marketplace_engaged,
    MAX(IF(event_name_base IN (
      'market_contact', 'market_contact_button',
      'contact_seller', 'Contact_seller', 'Marketplace_contact'
    ), 1, 0)) AS contacted_seller,
    MAX(IF(event_name_base IN (
      'Feed_screen', 'feed_bottom_nav', 'feed_like', 'feed_comment', 'feed_add',
      'Feed_open', 'feed_open', 'Feed_post', 'Feed_like', 'post_like'
    ), 1, 0)) AS feed_engaged,
    MAX(IF(event_name_base IN (
      'Homescreen', 'home_bottom_nav', 'Home', 'Home_open', 'home_open'
    ), 1, 0)) AS used_home,
    MAX(IF(event_name_base IN (
      'Identify_bottom_nav', 'Identify_home'
    ), 1, 0)) AS used_identify,
    AVG(IF(session_length_seconds > 0, session_length_seconds, NULL)) AS avg_session_length
  FROM `{PROJECT}.{DATASET}.v_events_normalized`
  WHERE resolved_user_id IS NOT NULL
  GROUP BY event_date, platform, country, resolved_user_id
),

engagement AS (
  SELECT
    event_date,
    platform,
    country,
    COUNTIF(had_success_id = 1) AS users_with_success_id,
    COUNTIF(had_success_id = 1 AND added_to_collection = 1) AS users_added_after_id,
    COUNTIF(opened_collection = 1) AS users_opened_collection,
    COUNTIF(opened_private_collection = 1) AS users_opened_private_collection,
    COUNTIF(opened_global_catalogue = 1) AS users_opened_global_catalogue,
    COUNTIF(viewed_detail = 1) AS users_viewed_detail,
    COUNTIF(used_filter = 1) AS users_used_filter,
    COUNTIF(marketplace_engaged = 1) AS users_marketplace,
    COUNTIF(contacted_seller = 1) AS users_contacted_seller,
    COUNTIF(feed_engaged = 1) AS users_feed,
    COUNTIF(used_home = 1) AS users_home,
    COUNTIF(used_identify = 1) AS users_identify_tab,
    AVG(avg_session_length) AS avg_session_length_seconds
  FROM user_day_flags
  GROUP BY event_date, platform, country
)

SELECT
  d.event_date,
  d.platform,
  d.country,
  d.dau,
  d.total_success_scans,
  d.total_identifications,
  d.users_with_scan,

  -- #15 Scans per active user (mean + percentiles among people who scanned)
  SAFE_DIVIDE(d.total_success_scans, d.dau) AS scans_per_dau,
  SAFE_DIVIDE(d.total_success_scans, d.users_with_scan) AS scans_per_scanning_user,
  d.scan_q[OFFSET(10)] AS scans_p10,
  d.scan_q[OFFSET(25)] AS scans_p25,
  d.scan_q[OFFSET(50)] AS scans_p50,
  d.scan_q[OFFSET(75)] AS scans_p75,
  d.scan_q[OFFSET(95)] AS scans_p95,
  d.scan_q[OFFSET(99)] AS scans_p99,

  -- #16 Collection add after identify
  e.users_with_success_id,
  e.users_added_after_id,
  SAFE_DIVIDE(e.users_added_after_id, e.users_with_success_id) AS collection_add_rate_after_id,

  -- #17 Private collection vs global catalogue (kept separate — do not mix)
  e.users_opened_collection,
  e.users_opened_private_collection,
  e.users_opened_global_catalogue,
  e.users_viewed_detail,
  e.users_used_filter,
  SAFE_DIVIDE(e.users_opened_private_collection, d.dau) AS private_collection_open_rate,
  SAFE_DIVIDE(e.users_opened_global_catalogue, d.dau) AS global_catalogue_open_rate,
  SAFE_DIVIDE(e.users_opened_collection, d.dau) AS collection_open_rate,

  -- #18 Marketplace & Feed
  e.users_marketplace,
  e.users_contacted_seller,
  e.users_feed,
  SAFE_DIVIDE(e.users_marketplace, d.dau) AS marketplace_engagement_rate,
  SAFE_DIVIDE(e.users_feed, d.dau) AS feed_engagement_rate,

  -- #20 Feature mix
  e.users_home,
  e.users_identify_tab,
  e.avg_session_length_seconds,
  SAFE_DIVIDE(e.users_home, d.dau) AS home_usage_rate,
  SAFE_DIVIDE(e.users_identify_tab, d.dau) AS identify_tab_usage_rate

FROM dau d
LEFT JOIN engagement e
  ON d.event_date = e.event_date
 AND d.platform = e.platform
 AND d.country = e.country;
