SELECT
  country,
  SUM(total_dau) AS total_dau,
  SUM(total_new_users) AS total_new_users
FROM `{PROJECT}.{SUMMARY_DATASET}.country_metrics`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY country
ORDER BY total_dau DESC
LIMIT 40;
