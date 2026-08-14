-- =============================================================================
-- New Users — by cohort date
-- Metabase: Number card + trend line
-- =============================================================================

SELECT
  cohort_date,
  COUNT(DISTINCT resolved_user_id) AS new_users
FROM `{PROJECT}.{DATASET}.v_new_users`
WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND first_country = {{country}}]]
  [[AND first_platform = {{platform}}]]
  [[AND first_app_version = {{app_version}}]]
GROUP BY cohort_date
ORDER BY cohort_date DESC;

-- Single-value (total in range):
-- SELECT COUNT(DISTINCT resolved_user_id) AS new_users
-- FROM `{PROJECT}.{DATASET}.v_new_users`
-- WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}};
