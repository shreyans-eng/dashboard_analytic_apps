-- =============================================================================
-- Banknote MVP #5 — Paywall → purchase (raw events)
-- In-app only: Subs_page / Subs_page_discount / Subscription_screen
-- Confirm is Subs_confirm only.
-- Do not mix onboarding subscription_shown (that is Funnels → Onboarding → subs).
-- =============================================================================

WITH bounds AS (
  SELECT
    FORMAT_DATE('%Y%m%d', {{start_date}}) AS start_s,
    FORMAT_DATE('%Y%m%d', {{end_date}}) AS end_s
),
base AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    {{resolved_user_id_cheap}} AS resolved_user_id,
    REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS event_name_base
  FROM `{PROJECT}.{DATASET}.events_*`, bounds
  WHERE _TABLE_SUFFIX BETWEEN start_s AND end_s
    AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
    [[AND event_country = {{country}}]]
    [[AND event_platform = {{platform}}]]
)
SELECT
  event_date,
  COUNTIF(event_name_base IN (
    'Subs_page', 'Subs_page_discount', 'Subscription_screen'
  )) AS paywall_impressions,
  COUNT(DISTINCT CASE WHEN event_name_base IN (
    'Subs_page', 'Subs_page_discount', 'Subscription_screen'
  ) THEN resolved_user_id END) AS users_saw_paywall,
  COUNTIF(event_name_base = 'Subs_confirm') AS purchase_confirms,
  COUNT(DISTINCT CASE
    WHEN event_name_base = 'Subs_confirm'
    THEN resolved_user_id END) AS paying_users,
  SAFE_DIVIDE(
    COUNTIF(event_name_base = 'Subs_confirm'),
    COUNTIF(event_name_base IN (
      'Subs_page', 'Subs_page_discount', 'Subscription_screen'
    ))
  ) AS paywall_to_confirm_rate,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE
      WHEN event_name_base = 'Subs_confirm'
      THEN resolved_user_id END),
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'Subs_page', 'Subs_page_discount', 'Subscription_screen'
    ) THEN resolved_user_id END)
  ) AS user_paywall_conversion_rate
FROM base
GROUP BY event_date
ORDER BY event_date;
