-- =============================================================================
-- Banknote daily product signals (raw events) — Compare + MVP rollup
-- Confirm is Subs_confirm only. Identify open is nav ∪ home.
-- In-app paywall only (not onboarding subscription_shown).
-- Cheap identity: GA4 user_id then user_pseudo_id — no event_params UNNEST.
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
    WHEN event_name_base = 'first_open'
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
    COUNT(DISTINCT CASE WHEN {{dau_event_predicate_base}} THEN resolved_user_id END)
  ) AS scans_per_dau,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'identiifcation_limit_exceeded', 'identification_limit_exceeded',
      'Identified_limit_reached', 'identified_limit_reached',
      'scan_quota_exhausted', 'Scan_quota_exhausted',
      'limit_exceeded', 'Limit_exceeded'
    ) THEN resolved_user_id END),
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'identification_done_success', 'Identification_done_success',
      'identification_done_failure', 'Identification_done_failure',
      'Identification_done'
    ) THEN resolved_user_id END)
  ) AS free_quota_hit_rate,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN event_name_base = 'Subs_confirm'
      THEN resolved_user_id END),
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'Subs_page', 'Subs_page_discount', 'Subscription_screen'
    ) THEN resolved_user_id END)
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
      'Collection_screen', 'Global_catalogue_screen', 'Global_catalogue',
      'private_collection_bottom_nav'
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
  COUNT(DISTINCT CASE WHEN event_name_base = 'Subs_confirm'
    THEN resolved_user_id END) AS paying_users,
  COUNTIF(event_name_base IN (
    'Subs_page', 'Subs_page_discount', 'Subscription_screen'
  )) AS paywall_impressions,
  COUNTIF(event_name_base = 'Subs_confirm') AS purchase_confirms
FROM base
GROUP BY event_date
ORDER BY event_date;
