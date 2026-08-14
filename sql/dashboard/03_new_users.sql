-- =============================================================================
-- Coinzy Executive Dashboard — New Users
-- Source view: v_new_users
-- Visualization: Line chart (cohort_date → new_users) OR Number card
-- Cohort anchor: install → registration → first event
-- =============================================================================

SELECT
  cohort_date,
  COUNT(DISTINCT resolved_user_id) AS new_users
FROM `{PROJECT}.{DATASET}.v_new_users`
WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND first_country = {{country}}]]
  [[AND first_platform = {{platform}}]]
GROUP BY cohort_date
ORDER BY cohort_date;

-- Number card variant (total in range):
-- SELECT COUNT(DISTINCT resolved_user_id) AS new_users
-- FROM `{PROJECT}.{DATASET}.v_new_users`
-- WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
-- [[AND first_country = {{country}}]]
-- [[AND first_platform = {{platform}}]];
