-- =============================================================================
-- Coinzy Executive Dashboard — Monthly Active Users
-- Source view: v_monthly_active_users
-- Visualization: Bar chart (activity_month → mau) OR Number card
-- =============================================================================

SELECT
  activity_month,
  COUNT(DISTINCT resolved_user_id) AS mau
FROM `{PROJECT}.{DATASET}.v_monthly_active_users`
WHERE activity_month BETWEEN DATE_TRUNC({{start_date}}, MONTH) AND DATE_TRUNC({{end_date}}, MONTH)
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY activity_month
ORDER BY activity_month;

-- Number card variant (month containing end_date):
-- SELECT COUNT(DISTINCT resolved_user_id) AS mau
-- FROM `{PROJECT}.{DATASET}.v_monthly_active_users`
-- WHERE activity_month = DATE_TRUNC({{end_date}}, MONTH)
-- [[AND country = {{country}}]]
-- [[AND platform = {{platform}}]];
