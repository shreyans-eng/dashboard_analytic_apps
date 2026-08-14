SELECT
  event_name_base,
  SUM(event_count) AS event_count,
  SUM(unique_users) AS unique_users
FROM `{PROJECT}.{SUMMARY_DATASET}.top_events`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY event_name_base
ORDER BY event_count DESC
LIMIT 50;
