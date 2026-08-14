-- =============================================================================
-- Coinzy Executive Dashboard — D1 Retention
-- Source view: v_retention_cohorts
-- Visualization: Number card (%), Line chart (cohort_date → d1_rate)
-- Maturity: exclude cohorts where cohort_date + 1 day > today
-- =============================================================================

-- Trend line (for chart)
SELECT
  cohort_date,
  SUM(cohort_size)     AS cohort_size,
  SUM(retained_d1)     AS retained_d1,
  SAFE_DIVIDE(SUM(retained_d1), SUM(cohort_size)) AS d1_retention_rate
FROM `{PROJECT}.{DATASET}.v_retention_cohorts`
WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
  AND DATE_ADD(cohort_date, INTERVAL 1 DAY) <= CURRENT_DATE()
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY cohort_date
ORDER BY cohort_date;

-- Number card variant (weighted average):
-- SELECT SAFE_DIVIDE(SUM(retained_d1), SUM(cohort_size)) AS d1_retention_rate
-- FROM `{PROJECT}.{DATASET}.v_retention_cohorts`
-- WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
--   AND DATE_ADD(cohort_date, INTERVAL 1 DAY) <= CURRENT_DATE()
-- [[AND country = {{country}}]]
-- [[AND platform = {{platform}}]];
