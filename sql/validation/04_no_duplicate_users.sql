-- =============================================================================
-- Validation: User counts are not duplicated at daily grain
-- Expected: duplicate_user_days = 0
-- v_daily_active_users should have exactly one row per (event_date, resolved_user_id)
-- =============================================================================

SELECT
  COUNT(*) AS duplicate_user_days
FROM (
  SELECT
    event_date,
    resolved_user_id,
    COUNT(*) AS row_count
  FROM `banknote-app-4f3fd.analytics_488476338.v_daily_active_users`
  GROUP BY event_date, resolved_user_id
  HAVING COUNT(*) > 1
);

-- Sanity check: DAU from view vs recomputed from same view
-- Expected: diff = 0 for each day

-- SELECT
--   a.event_date,
--   a.dau_from_view,
--   b.dau_recomputed,
--   a.dau_from_view - b.dau_recomputed AS diff
-- FROM (
--   SELECT event_date, COUNT(DISTINCT resolved_user_id) AS dau_from_view
--   FROM `banknote-app-4f3fd.analytics_488476338.v_daily_active_users`
--   GROUP BY event_date
-- ) a
-- JOIN (
--   SELECT event_date, COUNT(DISTINCT resolved_user_id) AS dau_recomputed
--   FROM `banknote-app-4f3fd.analytics_488476338.v_daily_active_users`
--   GROUP BY event_date
-- ) b USING (event_date)
-- WHERE a.dau_from_view != b.dau_recomputed
-- ORDER BY event_date DESC
-- LIMIT 10;
