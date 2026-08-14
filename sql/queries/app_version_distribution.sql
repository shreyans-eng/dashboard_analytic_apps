-- =============================================================================
-- App Version Distribution — users and events by app version
-- Metabase: Pie or bar chart
-- =============================================================================

SELECT
  app_version,
  platform,
  COUNT(DISTINCT resolved_user_id) AS unique_users,
  COUNT(*)                          AS event_count,
  ROUND(100.0 * COUNT(DISTINCT resolved_user_id) / SUM(COUNT(DISTINCT resolved_user_id)) OVER (), 2) AS pct_users
FROM `{PROJECT}.{DATASET}.v_events_normalized`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY app_version, platform
ORDER BY unique_users DESC;
