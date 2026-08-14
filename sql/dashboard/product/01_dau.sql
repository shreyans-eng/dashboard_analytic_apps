-- =============================================================================
-- MVP #1 — DAU (+ WAU optional via sql/queries/wau.sql)
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
