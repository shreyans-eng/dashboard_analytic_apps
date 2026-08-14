-- =============================================================================
-- Coinzy Executive Dashboard — D7 Retention
-- Source view: v_retention_cohorts
-- Visualization: Number card (%), Line chart (cohort_date → d7_rate)
-- Maturity: exclude cohorts where cohort_date + 7 days > today
-- =============================================================================

-- Trend line (for chart)
SELECT
  cohort_date,
  SUM(cohort_size)     AS cohort_size,
  SUM(retained_d7)     AS retained_d7,
  SAFE_DIVIDE(SUM(retained_d7), SUM(cohort_size)) AS d7_retention_rate
FROM `{PROJECT}.{DATASET}.v_retention_cohorts`
WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
  AND DATE_ADD(cohort_date, INTERVAL 7 DAY) <= CURRENT_DATE()
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY cohort_date
ORDER BY cohort_date;

-- Number card variant (weighted average):
-- SELECT SAFE_DIVIDE(SUM(retained_d7), SUM(cohort_size)) AS d7_retention_rate
-- FROM `{PROJECT}.{DATASET}.v_retention_cohorts`
-- WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
--   AND DATE_ADD(cohort_date, INTERVAL 7 DAY) <= CURRENT_DATE()
-- [[AND country = {{country}}]]
-- [[AND platform = {{platform}}]];
