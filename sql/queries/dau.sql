-- =============================================================================
-- DAU — Daily Active Users
-- Metabase: Number card with Date Range / Country / Platform / App Version filters
-- =============================================================================

SELECT
  event_date,
  COUNT(DISTINCT resolved_user_id) AS dau
FROM `{PROJECT}.{DATASET}.v_daily_active_users`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
  [[AND app_version = {{app_version}}]]
GROUP BY event_date
ORDER BY event_date DESC;

-- Single-value card (latest day in range):
-- SELECT COUNT(DISTINCT resolved_user_id) AS dau
-- FROM `{PROJECT}.{DATASET}.v_daily_active_users`
-- WHERE event_date = (SELECT MAX(event_date) FROM `{PROJECT}.{DATASET}.v_daily_active_users`
--                     WHERE event_date BETWEEN {{start_date}} AND {{end_date}});
