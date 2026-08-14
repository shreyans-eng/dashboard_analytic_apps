SELECT
  activity_month,
  SUM(mau) AS mau
FROM `{PROJECT}.{SUMMARY_DATASET}.monthly_active_users`
WHERE activity_month BETWEEN DATE_TRUNC({{start_date}}, MONTH) AND DATE_TRUNC({{end_date}}, MONTH)
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY activity_month
ORDER BY activity_month;
