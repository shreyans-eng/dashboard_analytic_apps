SELECT
  cohort_date,
  SUM(new_users) AS new_users
FROM `{PROJECT}.{SUMMARY_DATASET}.daily_new_users`
WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY cohort_date
ORDER BY cohort_date;
