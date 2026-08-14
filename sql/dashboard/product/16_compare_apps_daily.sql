-- =============================================================================
-- Compare Banknote vs Coinzy — daily DAU + MVP product signals by app
-- Includes funnel proxy, catalogue, marketplace (no free-scan variants).
-- =============================================================================

WITH labeled AS (
  SELECT
    event_date,
    resolved_user_id,
    event_name_base,
    CASE
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(app_name, '')), r'coinzy') THEN 'Coinzy'
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(app_name, '')), r'banknote') THEN 'Banknote'
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(app_id, '')), r'coinzy') THEN 'Coinzy'
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(app_id, '')), r'banknote') THEN 'Banknote'
      ELSE 'Unknown'
    END AS product
  FROM `{PROJECT}.{DATASET}.v_events_normalized`
  WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
    AND resolved_user_id IS NOT NULL
    [[AND country = {{country}}]]
    [[AND platform = {{platform}}]]
),

daily AS (
  SELECT
    event_date,
    product,
    COUNT(DISTINCT resolved_user_id) AS dau,
    COUNT(DISTINCT CASE
      WHEN event_name_base IN ('first_open', 'first_open_android', 'first_open_ios')
      THEN resolved_user_id END) AS installs,
    COUNTIF(event_name_base IN (
      'identification_done_success', 'Identification_done_success'
    )) AS success_scans,
    COUNTIF(event_name_base IN (
      'identification_done_failure', 'Identification_done_failure'
    )) AS failure_scans,
    COUNT(DISTINCT CASE
      WHEN event_name_base IN (
        'Identify_bottom_nav', 'Identify_home', 'Identification_screen',
        'Identify_open', 'Identify', 'identify_open', 'Identification_open'
      ) THEN resolved_user_id END) AS users_identify_open,
    COUNT(DISTINCT CASE
      WHEN event_name_base IN (
        'identification_done_success', 'Identification_done_success'
      ) THEN resolved_user_id END) AS users_success,
    COUNT(DISTINCT CASE
      WHEN event_name_base IN (
        'Identified_limit_reached', 'identified_limit_reached',
        'scan_quota_exhausted', 'Scan_quota_exhausted', 'limit_exceeded',
        'free_scan_limit_exceeded', 'free_scan_blocked',
        'free_scan_success_quota_exhausted',
        'Identification_unsuccessful_limit_reached'
      ) THEN resolved_user_id END) AS users_hit_quota,
    COUNT(DISTINCT CASE
      WHEN event_name_base IN (
        'identification_done_success', 'Identification_done_success',
        'identification_done_failure', 'Identification_done_failure',
        'Identification_done'
      ) THEN resolved_user_id END) AS users_attempted_scan,
    COUNT(DISTINCT CASE
      WHEN event_name_base IN (
        'Collection_screen', 'Global_catalogue_screen',
        'Collection_open', 'collection_open', 'Collection', 'My_collection'
      ) THEN resolved_user_id END) AS users_catalogue,
    COUNT(DISTINCT CASE
      WHEN event_name_base IN (
        'marketplace_screen', 'Marketplace_bottom_nav', 'marketplace_bottom_nav',
        'market_item_expolre', 'Feed_screen',
        'Marketplace_open', 'marketplace_open', 'Market_open',
        'Listing_view', 'listing_view'
      ) THEN resolved_user_id END) AS users_marketplace,
    COUNTIF(event_name_base IN (
      'Subs_page', 'Subs_page_discount', 'Subscription_screen', 'Subs_page_onboarding'
    )) AS paywall_impressions,
    COUNTIF(event_name_base IN (
      'Subs_confirm', 'subs_confirm', 'subs_confirm_discount', 'paid_purchase'
    )) AS purchase_confirms,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'Subs_confirm', 'subs_confirm', 'subs_confirm_discount', 'paid_purchase'
    ) THEN resolved_user_id END) AS paying_users
  FROM labeled
  WHERE product IN ('Banknote', 'Coinzy')
  GROUP BY event_date, product
)

SELECT
  event_date,
  product,
  dau,
  installs,
  success_scans,
  failure_scans,
  SAFE_DIVIDE(success_scans, success_scans + failure_scans) AS identification_success_rate,
  SAFE_DIVIDE(success_scans, dau) AS scans_per_dau,
  SAFE_DIVIDE(users_hit_quota, users_attempted_scan) AS free_quota_hit_rate,
  SAFE_DIVIDE(purchase_confirms, paywall_impressions) AS paywall_to_confirm_rate,
  SAFE_DIVIDE(users_success, users_identify_open) AS open_to_success_rate,
  SAFE_DIVIDE(users_catalogue, dau) AS catalogue_open_rate,
  SAFE_DIVIDE(users_marketplace, dau) AS marketplace_engagement_rate,
  paying_users,
  paywall_impressions,
  purchase_confirms
FROM daily
ORDER BY event_date, product;
