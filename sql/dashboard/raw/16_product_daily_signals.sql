-- =============================================================================
-- Raw-events daily product signals (one app / one dataset)
-- Used for Compare: run once per product, then union with product label.
-- =============================================================================

WITH base AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    COALESCE(
      user_id,
      (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'user_id'),
      user_pseudo_id
    ) AS resolved_user_id,
    REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS event_name_base
  FROM `{PROJECT}.{DATASET}.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', {{start_date}})
                          AND FORMAT_DATE('%Y%m%d', {{end_date}})
    AND _TABLE_SUFFIX NOT LIKE 'intraday_%'
    [[AND event_country = {{country}}]]
    [[AND event_platform = {{platform}}]]
)

SELECT
  event_date,
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
  SAFE_DIVIDE(
    COUNTIF(event_name_base IN ('identification_done_success', 'Identification_done_success')),
    COUNTIF(event_name_base IN (
      'identification_done_success', 'Identification_done_success',
      'identification_done_failure', 'Identification_done_failure'
    ))
  ) AS identification_success_rate,
  SAFE_DIVIDE(
    COUNTIF(event_name_base IN ('identification_done_success', 'Identification_done_success')),
    COUNT(DISTINCT resolved_user_id)
  ) AS scans_per_dau,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'Identified_limit_reached', 'identified_limit_reached',
      'scan_quota_exhausted', 'limit_exceeded',
      'free_scan_limit_exceeded', 'free_scan_blocked',
      'free_scan_success_quota_exhausted',
      'Identification_unsuccessful_limit_reached'
    ) THEN resolved_user_id END),
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'identification_done_success', 'Identification_done_success',
      'identification_done_failure', 'Identification_done_failure',
      'Identification_done'
    ) THEN resolved_user_id END)
  ) AS free_quota_hit_rate,
  SAFE_DIVIDE(
    COUNTIF(event_name_base IN (
      'Subs_confirm', 'subs_confirm', 'subs_confirm_discount', 'paid_purchase'
    )),
    COUNTIF(event_name_base IN (
      'Subs_page', 'Subs_page_discount', 'Subscription_screen', 'Subs_page_onboarding'
    ))
  ) AS paywall_to_confirm_rate,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'identification_done_success', 'Identification_done_success'
    ) THEN resolved_user_id END),
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      -- Banknote app entry (verified)
      'Identify_bottom_nav', 'Identify_home', 'Identification_screen',
      -- Legacy preferred aliases
      'Identify_open', 'Identify', 'identify_open', 'Identification_open'
    ) THEN resolved_user_id END)
  ) AS open_to_success_rate,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      -- Banknote-verified screen opens (primary)
      'Collection_screen', 'Global_catalogue_screen',
      -- Legacy / preferred aliases (keep for Coinzy + older docs)
      'Collection_open', 'collection_open', 'Collection', 'My_collection'
    ) THEN resolved_user_id END),
    COUNT(DISTINCT resolved_user_id)
  ) AS catalogue_open_rate,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      -- Banknote app (verified)
      'marketplace_screen', 'Marketplace_bottom_nav', 'marketplace_bottom_nav',
      'market_item_expolre', 'Feed_screen', 'feed_bottom_nav',
      -- Legacy preferred aliases
      'Marketplace_open', 'marketplace_open', 'Market_open',
      'Listing_view', 'listing_view'
    ) THEN resolved_user_id END),
    COUNT(DISTINCT resolved_user_id)
  ) AS marketplace_engagement_rate,
  COUNT(DISTINCT CASE WHEN event_name_base IN (
    'Subs_confirm', 'subs_confirm', 'subs_confirm_discount', 'paid_purchase'
  ) THEN resolved_user_id END) AS paying_users,
  COUNTIF(event_name_base IN (
    'Subs_page', 'Subs_page_discount', 'Subscription_screen', 'Subs_page_onboarding'
  )) AS paywall_impressions,
  COUNTIF(event_name_base IN (
    'Subs_confirm', 'subs_confirm', 'subs_confirm_discount', 'paid_purchase'
  )) AS purchase_confirms
FROM base
GROUP BY event_date
ORDER BY event_date;
