-- =============================================================================
-- Validation: Retention rates are within valid bounds
-- Expected: all rates between 0 and 1 (or 0–100%)
-- =============================================================================

SELECT
  cohort_date,
  platform,
  country,
  cohort_size,
  retention_d1_rate,
  retention_d7_rate
FROM `banknote-app-4f3fd.analytics_488476338.v_retention_cohorts`
WHERE retention_d1_rate < 0 OR retention_d1_rate > 1
   OR retention_d7_rate < 0 OR retention_d7_rate > 1
   OR cohort_size <= 0
ORDER BY cohort_date DESC
LIMIT 20;

-- Expected result: 0 rows
