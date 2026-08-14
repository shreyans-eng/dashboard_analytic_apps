-- =============================================================================
-- MVP #5 — Time to first scan (day-0 rate + median seconds)
-- =============================================================================

SELECT
  cohort_date AS event_date,
  SUM(cohort_users) AS cohort_users,
  SUM(users_scanned_day0) AS users_scanned_day0,
  SAFE_DIVIDE(SUM(users_scanned_day0), SUM(cohort_users)) AS day0_first_scan_rate,
  AVG(median_seconds_to_first_scan) AS median_seconds_to_first_scan
FROM `{PROJECT}.{DATASET}.v_time_to_first_scan`
WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY cohort_date
ORDER BY cohort_date;
