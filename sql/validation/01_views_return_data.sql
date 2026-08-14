-- =============================================================================
-- Validation: All views return at least one row
-- Expected: Each view_name has row_count > 0
-- =============================================================================

SELECT 'v_events_normalized' AS view_name, COUNT(*) AS row_count
FROM `banknote-app-4f3fd.analytics_488476338.v_events_normalized`
LIMIT 1

UNION ALL

SELECT 'v_daily_active_users', COUNT(*)
FROM `banknote-app-4f3fd.analytics_488476338.v_daily_active_users`
LIMIT 1

UNION ALL

SELECT 'v_monthly_active_users', COUNT(*)
FROM `banknote-app-4f3fd.analytics_488476338.v_monthly_active_users`
LIMIT 1

UNION ALL

SELECT 'v_new_users', COUNT(*)
FROM `banknote-app-4f3fd.analytics_488476338.v_new_users`
LIMIT 1

UNION ALL

SELECT 'v_country_metrics', COUNT(*)
FROM `banknote-app-4f3fd.analytics_488476338.v_country_metrics`
LIMIT 1

UNION ALL

SELECT 'v_retention_cohorts', COUNT(*)
FROM `banknote-app-4f3fd.analytics_488476338.v_retention_cohorts`
LIMIT 1;
