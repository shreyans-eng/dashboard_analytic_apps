-- =============================================================================
-- Coinzy Executive Dashboard — Top Events
-- Source view: v_events_normalized
-- Visualization: Row bar chart (event_name_base → event_count)
-- Uses normalized event names (strips _android / _ios suffix)
-- =============================================================================

SELECT
  event_name_base,
  COUNT(*)                         AS event_count,
  COUNT(DISTINCT resolved_user_id) AS unique_users
FROM `{PROJECT}.{DATASET}.v_events_normalized`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
  -- Exclude GA4 automatic noise events (optional — remove to include all)
  AND event_name_base NOT IN ('user_engagement', 'session_start', 'firebase_campaign')
GROUP BY event_name_base
ORDER BY event_count DESC
LIMIT 25;
