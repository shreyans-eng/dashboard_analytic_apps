-- =============================================================================
-- D7 Retention — % of cohort returning on day 7
-- Metabase: Number card (weighted average) + trend line by cohort_date
-- Note: Exclude cohorts where cohort_date + 7 days > today (immature cohorts)
-- =============================================================================

SELECT
  cohort_date,
  SUM(cohort_size)     AS cohort_size,
  SUM(retained_d7)     AS retained_d7,
  SAFE_DIVIDE(SUM(retained_d7), SUM(cohort_size)) AS d7_retention_rate
FROM `{PROJECT}.{DATASET}.v_retention_cohorts`
WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
  AND DATE_ADD(cohort_date, INTERVAL 7 DAY) <= CURRENT_DATE()  -- mature cohorts only
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
  [[AND app_version = {{app_version}}]]
GROUP BY cohort_date
ORDER BY cohort_date DESC;

-- Single-value weighted D7 for dashboard card:
-- SELECT SAFE_DIVIDE(SUM(retained_d7), SUM(cohort_size)) AS d7_retention_rate
-- FROM `{PROJECT}.{DATASET}.v_retention_cohorts`
-- WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
--   AND DATE_ADD(cohort_date, INTERVAL 7 DAY) <= CURRENT_DATE();
