-- =============================================================================
-- Coinzy Executive Dashboard — Daily Active Users
-- Source view: v_daily_active_users
-- Visualization: Line chart (event_date → dau)
-- Metabase variable syntax: wire {{start_date}}, {{end_date}}, optional filters
-- =============================================================================

SELECT
  event_date,
  COUNT(DISTINCT resolved_user_id) AS dau
FROM `{PROJECT}.{DATASET}.v_daily_active_users`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY event_date
ORDER BY event_date;

-- Number card variant (latest day in range):
-- SELECT COUNT(DISTINCT resolved_user_id) AS dau
-- FROM `{PROJECT}.{DATASET}.v_daily_active_users`
-- WHERE event_date = (
--   SELECT MAX(event_date)
--   FROM `{PROJECT}.{DATASET}.v_daily_active_users`
--   WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
-- )
-- [[AND country = {{country}}]]
-- [[AND platform = {{platform}}]];
