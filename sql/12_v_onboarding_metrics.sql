-- =============================================================================
-- v_onboarding_metrics
-- Onboarding start → complete. Metric #4
-- Depends on: v_events_normalized
-- =============================================================================

CREATE OR REPLACE VIEW `{PROJECT}.{DATASET}.v_onboarding_metrics` AS

WITH daily AS (
  SELECT
    event_date,
    platform,
    country,
    app_version,

    COUNT(DISTINCT CASE
      WHEN event_name_base IN (
        'onboarding_start', 'Onboarding_start', 'Onboarding_begin',
        'onboarding_shown', 'Onboarding'
      )
      OR (event_name_base LIKE 'Onboarding%' AND screen_index = 0)
      THEN resolved_user_id END) AS users_started,

    COUNT(DISTINCT CASE
      WHEN event_name_base IN (
        'onboarding_complete', 'Onboarding_complete', 'Onboarding_finish',
        'onboarding_finished', 'onboarding_done'
      )
      THEN resolved_user_id END) AS users_completed,

    COUNT(DISTINCT CASE
      WHEN event_name_base LIKE 'Onboarding%'
        OR event_name_base LIKE 'onboarding%'
      THEN resolved_user_id END) AS users_any_onboarding,

    -- Screen drop-off (when screen_index is logged)
    COUNT(DISTINCT CASE
      WHEN screen_index = 0 AND (
        event_name_base LIKE 'Onboarding%' OR event_name_base LIKE 'onboarding%'
      ) THEN resolved_user_id END) AS users_screen_0,
    COUNT(DISTINCT CASE
      WHEN screen_index = 1 AND (
        event_name_base LIKE 'Onboarding%' OR event_name_base LIKE 'onboarding%'
      ) THEN resolved_user_id END) AS users_screen_1,
    COUNT(DISTINCT CASE
      WHEN screen_index = 2 AND (
        event_name_base LIKE 'Onboarding%' OR event_name_base LIKE 'onboarding%'
      ) THEN resolved_user_id END) AS users_screen_2,
    COUNT(DISTINCT CASE
      WHEN screen_index = 3 AND (
        event_name_base LIKE 'Onboarding%' OR event_name_base LIKE 'onboarding%'
      ) THEN resolved_user_id END) AS users_screen_3

  FROM `{PROJECT}.{DATASET}.v_events_normalized`
  WHERE resolved_user_id IS NOT NULL
  GROUP BY event_date, platform, country, app_version
)

SELECT
  *,
  SAFE_DIVIDE(users_completed, users_started) AS onboarding_completion_rate,
  SAFE_DIVIDE(users_screen_1, users_screen_0) AS screen_0_to_1_rate,
  SAFE_DIVIDE(users_screen_2, users_screen_1) AS screen_1_to_2_rate,
  SAFE_DIVIDE(users_screen_3, users_screen_2) AS screen_2_to_3_rate
FROM daily;
