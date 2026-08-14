SELECT
  platform,
  SUM(unique_users) AS unique_users
FROM `{PROJECT}.{SUMMARY_DATASET}.platform_metrics`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY platform
ORDER BY unique_users DESC;
