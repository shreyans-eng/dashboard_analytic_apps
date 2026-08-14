-- =============================================================================
-- D1 Retention — % of cohort returning on day 1
-- Metabase: Number card (weighted average) + trend line by cohort_date
-- Note: Exclude cohorts where cohort_date + 1 day > today (immature cohorts)
-- =============================================================================

SELECT
  cohort_date,
  SUM(cohort_size)     AS cohort_size,
  SUM(retained_d1)     AS retained_d1,
  SAFE_DIVIDE(SUM(retained_d1), SUM(cohort_size)) AS d1_retention_rate
FROM `{PROJECT}.{DATASET}.v_retention_cohorts`
WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
  AND DATE_ADD(cohort_date, INTERVAL 1 DAY) <= CURRENT_DATE()  -- mature cohorts only
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
  [[AND app_version = {{app_version}}]]
GROUP BY cohort_date
ORDER BY cohort_date DESC;

-- Single-value weighted D1 for dashboard card:
-- SELECT SAFE_DIVIDE(SUM(retained_d1), SUM(cohort_size)) AS d1_retention_rate
-- FROM `{PROJECT}.{DATASET}.v_retention_cohorts`
-- WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
--   AND DATE_ADD(cohort_date, INTERVAL 1 DAY) <= CURRENT_DATE();
