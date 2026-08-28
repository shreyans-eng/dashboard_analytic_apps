-- =============================================================================
-- Coinzy daily product signals (raw events) — Compare + MVP rollup
-- Verified from CoinzyAndroid: Collection_screen / collection_bottom_nav,
-- marketplace_screen / marketplace_bottom_nav, Subs_page / subs_confirm.
-- Cheap identity: GA4 user_id (skip placeholders) then user_pseudo_id — no event_params UNNEST.
-- =============================================================================

WITH base AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    {{resolved_user_id_cheap}} AS resolved_user_id,
    REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS event_name_base
  FROM `{PROJECT}.{DATASET}.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', {{start_date}})
                          AND FORMAT_DATE('%Y%m%d', {{end_date}})
    AND _TABLE_SUFFIX NOT LIKE 'intraday_%'
    AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
    [[AND event_country = {{country}}]]
    [[AND event_platform = {{platform}}]]
)

SELECT
  event_date,
  COUNT(DISTINCT CASE WHEN {{dau_event_predicate_base}} THEN resolved_user_id END) AS dau,
  COUNT(DISTINCT CASE WHEN {{dau_event_predicate_base}} THEN resolved_user_id END) AS app_open_dau,
  COUNT(DISTINCT CASE WHEN {{notification_event_predicate_base}} THEN resolved_user_id END) AS notification_dau,
  COUNT(DISTINCT resolved_user_id) AS any_event_dau,
  COUNT(DISTINCT CASE
    WHEN event_name_base IN ('first_open', 'first_open_android', 'first_open_ios')
    THEN resolved_user_id END) AS installs,
  COUNTIF(event_name_base IN (
    'identification_done_success', 'Identification_done_success'
  )) AS success_scans,
  COUNTIF(event_name_base IN (
    'identification_done_failure', 'Identification_done_failure',
    'Identification_failed', 'Identification_unsuccessful'
  )) AS failure_scans,
  SAFE_DIVIDE(
    COUNTIF(event_name_base IN ('identification_done_success', 'Identification_done_success')),
    COUNTIF(event_name_base IN (
      'identification_done_success', 'Identification_done_success',
      'identification_done_failure', 'Identification_done_failure',
      'Identification_failed', 'Identification_unsuccessful'
    ))
  ) AS identification_success_rate,
  SAFE_DIVIDE(
    COUNTIF(event_name_base IN ('identification_done_success', 'Identification_done_success')),
    COUNT(DISTINCT CASE WHEN {{dau_event_predicate_base}} THEN resolved_user_id END)
  ) AS scans_per_dau,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'Identified_limit_reached', 'identified_limit_reached',
      'scan_quota_exhausted', 'limit_exceeded',
      'free_scan_limit_exceeded', 'free_scan_blocked',
      'free_scan_success_quota_exhausted',
      'Identification_unsuccessful_limit_reached',
      'Collection_limit_Reached'
    ) THEN resolved_user_id END),
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'identification_done_success', 'Identification_done_success',
      'identification_done_failure', 'Identification_done_failure',
      'Identification_done'
    ) THEN resolved_user_id END)
  ) AS free_quota_hit_rate,
  SAFE_DIVIDE(
    COUNTIF(event_name_base IN (
      'subs_confirm', 'subs_confirm_discount', 'Subs_confirm',
      'paid_purchase', 'trial_purchase'
    )),
    COUNTIF(event_name_base IN (
      'Subs_page', 'Subs_page_discount', 'Subscription_screen',
      'Subs_page_onboarding', 'subscription_shown'
    ))
  ) AS paywall_to_confirm_rate,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'identification_done_success', 'Identification_done_success'
    ) THEN resolved_user_id END),
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'Identify_bottom_nav', 'Identify_home', 'Identification_screen',
      'Identify_open', 'Identify', 'identify_open', 'Identification_open'
    ) THEN resolved_user_id END)
  ) AS open_to_success_rate,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'Collection_screen', 'Global_catalogue_screen', 'collection_bottom_nav',
      'Collection_open', 'collection_open', 'Collection', 'My_collection'
    ) THEN resolved_user_id END),
    COUNT(DISTINCT CASE WHEN {{dau_event_predicate_base}} THEN resolved_user_id END)
  ) AS catalogue_open_rate,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'marketplace_screen', 'marketplace_bottom_nav', 'Marketplace_bottom_nav',
      'market_item_expolre', 'Feed_screen', 'feed_bottom_nav',
      'Marketplace_open', 'marketplace_open', 'Market_open',
      'Listing_view', 'listing_view'
    ) THEN resolved_user_id END),
    COUNT(DISTINCT CASE WHEN {{dau_event_predicate_base}} THEN resolved_user_id END)
  ) AS marketplace_engagement_rate,
  COUNT(DISTINCT CASE WHEN event_name_base IN (
    'subs_confirm', 'subs_confirm_discount', 'Subs_confirm',
    'paid_purchase', 'trial_purchase'
  ) THEN resolved_user_id END) AS paying_users,
  COUNTIF(event_name_base IN (
    'Subs_page', 'Subs_page_discount', 'Subscription_screen',
    'Subs_page_onboarding', 'subscription_shown'
  )) AS paywall_impressions,
  COUNTIF(event_name_base IN (
    'subs_confirm', 'subs_confirm_discount', 'Subs_confirm',
    'paid_purchase', 'trial_purchase'
  )) AS purchase_confirms
FROM base
GROUP BY event_date
ORDER BY event_date;
