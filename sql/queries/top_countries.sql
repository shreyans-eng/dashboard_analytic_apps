-- =============================================================================
-- Top Countries — ranked by DAU in date range
-- Metabase: Bar chart (horizontal)
-- =============================================================================

SELECT
  country,
  COUNT(DISTINCT resolved_user_id) AS unique_users,
  SUM(event_count)                 AS total_events,
  COUNT(DISTINCT event_date)       AS active_days
FROM `{PROJECT}.{DATASET}.v_daily_active_users`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND platform = {{platform}}]]
  [[AND app_version = {{app_version}}]]
GROUP BY country
ORDER BY unique_users DESC
LIMIT 20;

-- Alternative from v_country_metrics (includes new users + identifications):
-- SELECT country, SUM(dau) AS total_dau, SUM(new_users) AS total_new_users
-- FROM `{PROJECT}.{DATASET}.v_country_metrics`
-- WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
-- GROUP BY country ORDER BY total_dau DESC LIMIT 20;
