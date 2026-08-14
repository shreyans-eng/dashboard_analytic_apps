-- =============================================================================
-- v_monthly_active_users
-- One row per resolved_user_id per calendar month.
-- Depends on: v_daily_active_users
-- =============================================================================

CREATE OR REPLACE VIEW `{PROJECT}.{DATASET}.v_monthly_active_users` AS

SELECT
  DATE_TRUNC(event_date, MONTH)                     AS activity_month,
  resolved_user_id,
  user_pseudo_id,

  APPROX_TOP_COUNT(platform, 1)[OFFSET(0)].value     AS platform,
  APPROX_TOP_COUNT(country, 1)[OFFSET(0)].value       AS country,
  APPROX_TOP_COUNT(app_version, 1)[OFFSET(0)].value   AS app_version,

  COUNT(DISTINCT event_date)                          AS active_days_in_month,
  SUM(event_count)                                    AS total_events,
  SUM(app_open_count)                                 AS total_app_opens,
  SUM(identifications)                                AS total_identifications,
  SUM(identifications_success)                        AS total_identifications_success,
  SUM(subscription_confirms)                          AS total_subscription_confirms,

  MIN(first_event_at)                                 AS first_active_at_in_month,
  MAX(last_event_at)                                  AS last_active_at_in_month

FROM `{PROJECT}.{DATASET}.v_daily_active_users`
GROUP BY
  activity_month,
  resolved_user_id,
  user_pseudo_id;
