-- Combined D1 + D7 retention — single scan of daily_retention summary table
SELECT
  cohort_date,
  SUM(cohort_size) AS cohort_size,
  SUM(retained_d1) AS retained_d1,
  SUM(retained_d7) AS retained_d7,
  SAFE_DIVIDE(SUM(retained_d1), SUM(cohort_size)) AS d1_retention_rate,
  SAFE_DIVIDE(SUM(retained_d7), SUM(cohort_size)) AS d7_retention_rate
FROM `{PROJECT}.{SUMMARY_DATASET}.daily_retention`
WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY cohort_date
ORDER BY cohort_date;
