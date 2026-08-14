-- =============================================================================
-- Top Events — ranked by volume in date range
-- Metabase: Bar chart or table
-- =============================================================================

SELECT
  event_name_base,
  platform,
  COUNT(*)                          AS event_count,
  COUNT(DISTINCT resolved_user_id)  AS unique_users
FROM `{PROJECT}.{DATASET}.v_events_normalized`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
  [[AND app_version = {{app_version}}]]
GROUP BY event_name_base, platform
ORDER BY event_count DESC
LIMIT 50;

-- Aggregated across platforms:
-- SELECT event_name_base, COUNT(*) AS event_count, COUNT(DISTINCT resolved_user_id) AS unique_users
-- FROM `{PROJECT}.{DATASET}.v_events_normalized`
-- WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
-- GROUP BY event_name_base ORDER BY event_count DESC LIMIT 50;
