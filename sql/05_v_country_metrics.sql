-- =============================================================================
-- v_country_metrics
-- Daily KPIs by country.
-- Depends on: v_events_normalized, v_daily_active_users, v_new_users
-- =============================================================================

CREATE OR REPLACE VIEW `{PROJECT}.{DATASET}.v_country_metrics` AS

WITH daily_dau AS (
  SELECT
    event_date,
    country,
    platform,
    COUNT(DISTINCT resolved_user_id) AS dau
  FROM `{PROJECT}.{DATASET}.v_daily_active_users`
  GROUP BY event_date, country, platform
),

daily_new AS (
  SELECT
    cohort_date AS event_date,
    first_country AS country,
    first_platform AS platform,
    COUNT(DISTINCT resolved_user_id) AS new_users
  FROM `{PROJECT}.{DATASET}.v_new_users`
  GROUP BY cohort_date, first_country, first_platform
),

daily_events AS (
  SELECT
    event_date,
    country,
    platform,
    COUNT(*) AS total_events,
    COUNTIF(event_name_base IN (
      'identification_done_success', 'Identification_done_success'
    )) AS identifications_success,
    COUNTIF(event_name_base IN (
      'identification_done_failure', 'Identification_done_failure'
    )) AS identifications_failure,
    COUNTIF(event_name_base IN (
      'Subs_confirm', 'subs_confirm', 'subs_confirm_discount', 'paid_purchase'
    )) AS subscription_confirms,
    COUNTIF(event_name_base IN (
      'Subs_page', 'Subs_page_discount', 'Subscription_screen', 'Subs_page_onboarding'
    )) AS subs_page_views,
    COUNTIF(event_name_base = 'Registration')              AS registrations,
    COUNTIF(event_name_base = 'Login')                       AS logins
  FROM `{PROJECT}.{DATASET}.v_events_normalized`
  GROUP BY event_date, country, platform
),

combined AS (
  SELECT
    COALESCE(e.event_date, d.event_date, n.event_date) AS event_date,
    COALESCE(e.country, d.country, n.country)           AS country,
    COALESCE(e.platform, d.platform, n.platform)       AS platform,

    COALESCE(d.dau, 0)           AS dau,
    COALESCE(n.new_users, 0)     AS new_users,
    COALESCE(e.total_events, 0)  AS total_events,
    COALESCE(e.identifications_success, 0) AS identifications_success,
    COALESCE(e.identifications_failure, 0) AS identifications_failure,
    COALESCE(e.subscription_confirms, 0)   AS subscription_confirms,
    COALESCE(e.subs_page_views, 0)       AS subs_page_views,
    COALESCE(e.registrations, 0)         AS registrations,
    COALESCE(e.logins, 0)                AS logins

  FROM daily_events e
  FULL OUTER JOIN daily_dau d
    ON e.event_date = d.event_date
   AND e.country = d.country
   AND e.platform = d.platform
  FULL OUTER JOIN daily_new n
    ON COALESCE(e.event_date, d.event_date) = n.event_date
   AND COALESCE(e.country, d.country) = n.country
   AND COALESCE(e.platform, d.platform) = n.platform
)

SELECT
  event_date,
  country,
  platform,
  dau,
  new_users,
  total_events,
  identifications_success,
  identifications_failure,
  subscription_confirms,
  subs_page_views,
  registrations,
  logins,

  SAFE_DIVIDE(identifications_success, identifications_success + identifications_failure) AS identification_success_rate,
  SAFE_DIVIDE(subscription_confirms, subs_page_views)                                     AS subs_conversion_rate

FROM combined
WHERE event_date IS NOT NULL;
