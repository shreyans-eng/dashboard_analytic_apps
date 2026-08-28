-- =============================================================================
-- Raw-events daily product signals (one app / one dataset)
-- Used for Compare: run once per product, then union with product label.
-- dau = app_open_dau (session_start / App_open / first_open).
-- notification_dau and any_event_dau are supporting series, not mixed into dau.
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
    WHEN event_name_base = 'first_open'
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
      'identiifcation_limit_exceeded', 'identification_limit_exceeded',
      'scan_quota_exhausted', 'limit_exceeded',
      'free_scan_limit_exceeded', 'free_scan_blocked',
      'free_scan_success_quota_exhausted', 'free_scan_fail_quota_exhausted',
      'Identification_unsuccessful_limit_reached'
    ) THEN resolved_user_id END),
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'identification_done_success', 'Identification_done_success',
      'identification_done_failure', 'Identification_done_failure',
      'Identification_failed', 'Identification_unsuccessful',
      'Identification_done'
    ) THEN resolved_user_id END)
  ) AS free_quota_hit_rate,
  SAFE_DIVIDE(
    COUNTIF(event_name_base IN (
      'Subs_confirm', 'subs_confirm', 'subs_confirm_discount',
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
      'Identify_bottom_nav', 'Identify_home'
    ) THEN resolved_user_id END)
  ) AS open_to_success_rate,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'Collection_screen', 'Global_catalogue_screen',
      'collection_bottom_nav', 'private_collection_bottom_nav'
    ) THEN resolved_user_id END),
    COUNT(DISTINCT CASE WHEN {{dau_event_predicate_base}} THEN resolved_user_id END)
  ) AS catalogue_open_rate,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'marketplace_screen', 'Marketplace_bottom_nav', 'marketplace_bottom_nav',
      'market_item_expolre'
    ) THEN resolved_user_id END),
    COUNT(DISTINCT CASE WHEN {{dau_event_predicate_base}} THEN resolved_user_id END)
  ) AS marketplace_engagement_rate,
  COUNT(DISTINCT CASE WHEN event_name_base IN (
    'Subs_confirm', 'subs_confirm', 'subs_confirm_discount',
    'paid_purchase', 'trial_purchase'
  ) THEN resolved_user_id END) AS paying_users,
  COUNTIF(event_name_base IN (
    'Subs_page', 'Subs_page_discount', 'Subscription_screen',
    'Subs_page_onboarding', 'subscription_shown'
  )) AS paywall_impressions,
  COUNTIF(event_name_base IN (
    'Subs_confirm', 'subs_confirm', 'subs_confirm_discount',
    'paid_purchase', 'trial_purchase'
  )) AS purchase_confirms
FROM base
GROUP BY event_date
ORDER BY event_date;
