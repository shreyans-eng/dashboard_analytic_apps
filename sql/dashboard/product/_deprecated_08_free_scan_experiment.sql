-- =============================================================================
-- DEPRECATED — Free-scan experiment (removed from MVP)
-- Reason: product team dropped variant comparison from dashboard MVP.
-- Kept for ad-hoc analysis only. Prefer MVP #1–10 in this folder.
-- Original: scan_limit_variant → scans, D1/D7, Pro conversion.
-- =============================================================================

SELECT
  scan_limit_variant,
  SUM(cohort_size) AS cohort_size,
  SAFE_DIVIDE(SUM(avg_scans_per_user_d7 * cohort_size), SUM(cohort_size))
    AS avg_scans_per_user_d7,
  SAFE_DIVIDE(SUM(retained_d1), SUM(cohort_size)) AS retention_d1_rate,
  SAFE_DIVIDE(SUM(retained_d7), SUM(cohort_size)) AS retention_d7_rate,
  SAFE_DIVIDE(SUM(pro_converts_d7), SUM(cohort_size)) AS pro_conversion_d7_rate,
  SAFE_DIVIDE(SUM(pro_converts_d30), SUM(cohort_size)) AS pro_conversion_d30_rate
FROM `{PROJECT}.{DATASET}.v_scan_experiment_metrics`
WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
  AND cohort_date <= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY scan_limit_variant
ORDER BY scan_limit_variant;
