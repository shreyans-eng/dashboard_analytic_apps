-- =============================================================================
-- MAU — Monthly Active Users
-- Metabase: Number card with month filter
-- =============================================================================

SELECT
  DATE_TRUNC(event_date, MONTH) AS activity_month,
  COUNT(DISTINCT resolved_user_id) AS mau
FROM `{PROJECT}.{DATASET}.v_daily_active_users`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
  [[AND app_version = {{app_version}}]]
GROUP BY activity_month
ORDER BY activity_month DESC;

-- Alternative: use v_monthly_active_users directly
-- SELECT activity_month, COUNT(DISTINCT resolved_user_id) AS mau
-- FROM `{PROJECT}.{DATASET}.v_monthly_active_users`
-- WHERE activity_month BETWEEN DATE_TRUNC({{start_date}}, MONTH) AND DATE_TRUNC({{end_date}}, MONTH)
-- GROUP BY activity_month;
