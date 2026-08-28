-- =============================================================================
-- Scheduled / refresh: product_daily_signals
-- Common KPI daily grain for MVP + Compare (one row per event_date)
-- Source: raw Firebase events_* (never mutates raw)
-- Idempotent: DELETE window then INSERT
-- Placeholders: {PROJECT} {DATASET} {SUMMARY_DATASET} {START_SUFFIX} {END_SUFFIX}
--
-- DAU fields (computed from events_*, never copied from an older `dau` column):
--   app_open_dau      = distinct users with session_start / App_open / first_open
--   notification_dau  = distinct users with push display/receive/open/interact
--   any_event_dau     = distinct users with any Firebase event that day
--   dau               = synonym of app_open_dau (backward compatible dashboard field)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `{PROJECT}.{SUMMARY_DATASET}.product_daily_signals` (
  event_date                     DATE      NOT NULL,
  dau                            INT64     NOT NULL,
  app_open_dau                   INT64,
  notification_dau               INT64,
  any_event_dau                  INT64,
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

ALTER TABLE `{PROJECT}.{SUMMARY_DATASET}.product_daily_signals`
  ADD COLUMN IF NOT EXISTS app_open_dau INT64,
  ADD COLUMN IF NOT EXISTS notification_dau INT64,
  ADD COLUMN IF NOT EXISTS any_event_dau INT64;

DELETE FROM `{PROJECT}.{SUMMARY_DATASET}.product_daily_signals`
WHERE event_date BETWEEN PARSE_DATE('%Y%m%d', '{START_SUFFIX}')
                     AND PARSE_DATE('%Y%m%d', '{END_SUFFIX}');

INSERT INTO `{PROJECT}.{SUMMARY_DATASET}.product_daily_signals` (
  event_date,
  dau,
  app_open_dau,
  notification_dau,
  any_event_dau,
  installs,
  success_scans,
  failure_scans,
  identification_success_rate,
  scans_per_dau,
  free_quota_hit_rate,
  paywall_to_confirm_rate,
  open_to_success_rate,
  catalogue_open_rate,
  marketplace_engagement_rate,
  paying_users,
  paywall_impressions,
  purchase_confirms,
  refreshed_at
)
WITH base AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    {{resolved_user_id_cheap}} AS resolved_user_id,
    REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS event_name_base
  FROM `{PROJECT}.{DATASET}.events_*`
  WHERE _TABLE_SUFFIX BETWEEN '{START_SUFFIX}' AND '{END_SUFFIX}'
    AND _TABLE_SUFFIX NOT LIKE 'intraday_%'
    AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
),
counts AS (
  SELECT
    event_date,
    COUNT(DISTINCT CASE WHEN {{dau_event_predicate_base}} THEN resolved_user_id END) AS app_open_dau,
    COUNT(DISTINCT CASE WHEN {{notification_event_predicate_base}} THEN resolved_user_id END) AS notification_dau,
    COUNT(DISTINCT resolved_user_id) AS any_event_dau,
    COUNT(DISTINCT CASE
      WHEN event_name_base = 'first_open'
      THEN resolved_user_id END) AS installs,
    COUNTIF(event_name_base IN (
      'identification_done_success', 'Identification_done_success'
    )) AS success_scans,
    COUNTIF(event_name_base IN (
      'identification_done_failure', 'Identification_done_failure',
      'Identification_failed', 'Identification_unsuccessful'
    )) AS failure_scans,
    COUNTIF(event_name_base IN (
      'identification_done_success', 'Identification_done_success',
      'identification_done_failure', 'Identification_done_failure',
      'Identification_failed', 'Identification_unsuccessful'
    )) AS identify_outcomes,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'Identified_limit_reached', 'identified_limit_reached',
      'identiifcation_limit_exceeded', 'identification_limit_exceeded',
      'scan_quota_exhausted', 'limit_exceeded',
      'free_scan_limit_exceeded', 'free_scan_blocked',
      'free_scan_success_quota_exhausted', 'free_scan_fail_quota_exhausted',
      'Identification_unsuccessful_limit_reached'
    ) THEN resolved_user_id END) AS quota_hit_users,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'identification_done_success', 'Identification_done_success',
      'identification_done_failure', 'Identification_done_failure',
      'Identification_failed', 'Identification_unsuccessful',
      'Identification_done'
    ) THEN resolved_user_id END) AS identify_users,
    COUNTIF(event_name_base IN (
      'Subs_confirm', 'subs_confirm', 'subs_confirm_discount',
      'paid_purchase', 'trial_purchase'
    )) AS purchase_confirms,
    COUNTIF(event_name_base IN (
      'Subs_page', 'Subs_page_discount', 'Subscription_screen',
      'Subs_page_onboarding', 'subscription_shown'
    )) AS paywall_impressions,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'identification_done_success', 'Identification_done_success'
    ) THEN resolved_user_id END) AS success_users,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'Identify_bottom_nav', 'Identify_home'
    ) THEN resolved_user_id END) AS identify_open_users,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'Collection_screen', 'Global_catalogue_screen',
      'collection_bottom_nav', 'private_collection_bottom_nav'
    ) THEN resolved_user_id END) AS catalogue_users,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'marketplace_screen', 'Marketplace_bottom_nav', 'marketplace_bottom_nav',
      'market_item_expolre'
    ) THEN resolved_user_id END) AS marketplace_users,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'Subs_confirm', 'subs_confirm', 'subs_confirm_discount',
      'paid_purchase', 'trial_purchase'
    ) THEN resolved_user_id END) AS paying_users
  FROM base
  GROUP BY event_date
)
SELECT
  event_date,
  app_open_dau AS dau,
  app_open_dau,
  notification_dau,
  any_event_dau,
  installs,
  success_scans,
  failure_scans,
  SAFE_DIVIDE(success_scans, identify_outcomes) AS identification_success_rate,
  SAFE_DIVIDE(success_scans, app_open_dau) AS scans_per_dau,
  SAFE_DIVIDE(quota_hit_users, identify_users) AS free_quota_hit_rate,
  SAFE_DIVIDE(purchase_confirms, paywall_impressions) AS paywall_to_confirm_rate,
  SAFE_DIVIDE(success_users, identify_open_users) AS open_to_success_rate,
  SAFE_DIVIDE(catalogue_users, app_open_dau) AS catalogue_open_rate,
  SAFE_DIVIDE(marketplace_users, app_open_dau) AS marketplace_engagement_rate,
  paying_users,
  paywall_impressions,
  purchase_confirms,
  CURRENT_TIMESTAMP() AS refreshed_at
FROM counts;
