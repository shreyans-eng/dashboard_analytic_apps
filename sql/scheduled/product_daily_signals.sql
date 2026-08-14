-- =============================================================================
-- Scheduled / refresh: product_daily_signals
-- Common KPI daily grain for MVP + Compare (one row per event_date)
-- Source: raw Firebase events_* (never mutates raw)
-- Idempotent: DELETE window then INSERT
-- Placeholders: {PROJECT} {DATASET} {SUMMARY_DATASET} {START_SUFFIX} {END_SUFFIX}
-- =============================================================================

CREATE TABLE IF NOT EXISTS `{PROJECT}.{SUMMARY_DATASET}.product_daily_signals` (
  event_date                     DATE      NOT NULL,
  dau                            INT64     NOT NULL,
  installs                       INT64     NOT NULL,
  success_scans                  INT64     NOT NULL,
  failure_scans                  INT64     NOT NULL,
  identification_success_rate    FLOAT64,
  scans_per_dau                  FLOAT64,
  free_quota_hit_rate            FLOAT64,
  paywall_to_confirm_rate        FLOAT64,
  open_to_success_rate           FLOAT64,
  catalogue_open_rate            FLOAT64,
  marketplace_engagement_rate    FLOAT64,
  paying_users                   INT64     NOT NULL,
  paywall_impressions            INT64     NOT NULL,
  purchase_confirms              INT64     NOT NULL,
  refreshed_at                   TIMESTAMP NOT NULL
)
PARTITION BY event_date;

DELETE FROM `{PROJECT}.{SUMMARY_DATASET}.product_daily_signals`
WHERE event_date BETWEEN PARSE_DATE('%Y%m%d', '{START_SUFFIX}')
                     AND PARSE_DATE('%Y%m%d', '{END_SUFFIX}');

INSERT INTO `{PROJECT}.{SUMMARY_DATASET}.product_daily_signals`
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
  WHERE _TABLE_SUFFIX BETWEEN '{START_SUFFIX}' AND '{END_SUFFIX}'
    AND _TABLE_SUFFIX NOT LIKE 'intraday_%'
    AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
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
      'Identify_bottom_nav', 'Identify_home', 'Identification_screen',
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
      'marketplace_screen', 'Marketplace_bottom_nav', 'marketplace_bottom_nav',
      'market_item_expolre', 'Feed_screen', 'feed_bottom_nav',
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
  )) AS purchase_confirms,
  CURRENT_TIMESTAMP() AS refreshed_at
FROM base
GROUP BY event_date;
