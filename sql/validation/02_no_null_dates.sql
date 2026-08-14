-- =============================================================================
-- Validation: No NULL primary date columns in views
-- Expected: null_count = 0 for all checks
-- =============================================================================

SELECT 'v_daily_active_users.event_date' AS check_name,
       COUNTIF(event_date IS NULL) AS null_count
FROM `banknote-app-4f3fd.analytics_488476338.v_daily_active_users`

UNION ALL

SELECT 'v_monthly_active_users.activity_month',
       COUNTIF(activity_month IS NULL)
FROM `banknote-app-4f3fd.analytics_488476338.v_monthly_active_users`

UNION ALL

SELECT 'v_new_users.cohort_date',
       COUNTIF(cohort_date IS NULL)
FROM `banknote-app-4f3fd.analytics_488476338.v_new_users`

UNION ALL

SELECT 'v_country_metrics.event_date',
       COUNTIF(event_date IS NULL)
FROM `banknote-app-4f3fd.analytics_488476338.v_country_metrics`

UNION ALL

SELECT 'v_retention_cohorts.cohort_date',
       COUNTIF(cohort_date IS NULL)
FROM `banknote-app-4f3fd.analytics_488476338.v_retention_cohorts`;
