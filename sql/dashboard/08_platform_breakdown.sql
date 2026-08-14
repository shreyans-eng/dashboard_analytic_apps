-- =============================================================================
-- Coinzy Dashboard — Platform Breakdown
-- Source view: v_daily_active_users
-- Visualization: Pie chart or Row bar (platform → dau)
-- =============================================================================

SELECT
  platform,
  COUNT(DISTINCT resolved_user_id) AS unique_users,
  SUM(event_count) AS total_events,
  COUNT(DISTINCT event_date) AS active_days
FROM `{PROJECT}.{DATASET}.v_daily_active_users`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
  AND platform IS NOT NULL
GROUP BY platform
ORDER BY unique_users DESC;
