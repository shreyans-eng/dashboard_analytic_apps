-- =============================================================================
-- MVP #14 — D1 / D7 retention (weighted)
-- =============================================================================

SELECT
  cohort_date,
  SUM(cohort_size) AS cohort_size,
  SAFE_DIVIDE(SUM(retained_d1), SUM(cohort_size)) AS d1_retention_rate,
  SAFE_DIVIDE(SUM(retained_d7), SUM(cohort_size)) AS d7_retention_rate,
  SAFE_DIVIDE(SUM(retained_d30), SUM(cohort_size)) AS d30_retention_rate
FROM `{PROJECT}.{DATASET}.v_retention_cohorts`
WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
  AND cohort_date <= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)  -- mature for D7
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY cohort_date
ORDER BY cohort_date;
