-- =============================================================================
-- Engagement tab — collection / marketplace / feed
-- =============================================================================

SELECT
  event_date,
  SUM(dau) AS dau,
  SAFE_DIVIDE(SUM(users_added_after_id), SUM(users_with_success_id)) AS collection_add_rate_after_id,
  SAFE_DIVIDE(SUM(users_opened_collection), SUM(dau)) AS collection_open_rate,
  SAFE_DIVIDE(SUM(users_marketplace), SUM(dau)) AS marketplace_rate,
  SAFE_DIVIDE(SUM(users_feed), SUM(dau)) AS feed_rate,
  AVG(avg_session_length_seconds) AS avg_session_length_seconds
FROM `{PROJECT}.{DATASET}.v_engagement_metrics`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY event_date
ORDER BY event_date;
