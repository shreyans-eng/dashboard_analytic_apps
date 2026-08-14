-- =============================================================================
-- v_daily_active_users
-- One row per resolved_user_id per active day.
-- Active = any event OR explicit session-start events.
-- Depends on: v_events_normalized
-- =============================================================================

CREATE OR REPLACE VIEW `{PROJECT}.{DATASET}.v_daily_active_users` AS

SELECT
  event_date,
  resolved_user_id,
  user_pseudo_id,

  -- Most common dimension values that day (for Metabase filters)
  APPROX_TOP_COUNT(platform, 1)[OFFSET(0)].value   AS platform,
  APPROX_TOP_COUNT(country, 1)[OFFSET(0)].value     AS country,
  APPROX_TOP_COUNT(app_version, 1)[OFFSET(0)].value AS app_version,

  COUNT(*)                                          AS event_count,
  COUNTIF(is_session_start_event)                   AS session_start_events,
  COUNTIF(event_name_base IN ('App_open', 'App_open_android', 'App_open_ios')) AS app_open_count,
  MIN(event_timestamp)                              AS first_event_at,
  MAX(event_timestamp)                              AS last_event_at,

  -- Key product actions that day
  COUNTIF(event_name_base IN (
    'Identification_done', 'identification_done_success', 'Identification_done_success'
  )) AS identifications,
  COUNTIF(event_name_base IN (
    'identification_done_success', 'Identification_done_success'
  )) AS identifications_success,
  COUNTIF(event_name_base IN (
    'Subs_confirm', 'subs_confirm', 'subs_confirm_discount', 'paid_purchase'
  )) AS subscription_confirms,
  COUNTIF(event_name_base IN ('Registration', 'first_open'))    AS registration_or_install_signals

FROM `{PROJECT}.{DATASET}.v_events_normalized`
WHERE resolved_user_id IS NOT NULL
GROUP BY
  event_date,
  resolved_user_id,
  user_pseudo_id;
