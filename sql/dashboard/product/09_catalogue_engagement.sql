-- =============================================================================
-- MVP #9 — Catalogue / collection engagement
-- Collection opens, detail views, add-after-identify rate.
-- =============================================================================

SELECT
  event_date,
  SUM(dau) AS dau,
  SUM(users_opened_collection) AS users_opened_collection,
  SUM(users_viewed_detail) AS users_viewed_detail,
  SUM(users_used_filter) AS users_used_filter,
  SUM(users_with_success_id) AS users_with_success_id,
  SUM(users_added_after_id) AS users_added_after_id,
  SAFE_DIVIDE(SUM(users_opened_collection), SUM(dau)) AS catalogue_open_rate,
  SAFE_DIVIDE(SUM(users_viewed_detail), SUM(dau)) AS catalogue_detail_rate,
  SAFE_DIVIDE(SUM(users_added_after_id), SUM(users_with_success_id)) AS collection_add_rate_after_id
FROM `{PROJECT}.{DATASET}.v_engagement_metrics`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY event_date
ORDER BY event_date;
