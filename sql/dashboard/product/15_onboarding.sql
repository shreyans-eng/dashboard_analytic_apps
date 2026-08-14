-- =============================================================================
-- Onboarding completion (metric #4)
-- =============================================================================

SELECT
  event_date,
  SUM(users_started) AS started,
  SUM(users_completed) AS completed,
  SAFE_DIVIDE(SUM(users_completed), SUM(users_started)) AS onboarding_completion_rate,
  SAFE_DIVIDE(SUM(users_screen_1), SUM(users_screen_0)) AS screen_0_to_1,
  SAFE_DIVIDE(SUM(users_screen_2), SUM(users_screen_1)) AS screen_1_to_2
FROM `{PROJECT}.{DATASET}.v_onboarding_metrics`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY event_date
ORDER BY event_date;
