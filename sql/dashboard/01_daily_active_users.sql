-- =============================================================================
-- Daily Active Users (view path)
-- Active = session_start / App_open / first_open that day — not any Firebase event.
-- =============================================================================

SELECT
  event_date,
  COUNT(DISTINCT resolved_user_id) AS dau
FROM `{PROJECT}.{DATASET}.v_events_normalized`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  AND {{dau_event_predicate}}
  AND resolved_user_id IS NOT NULL
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY event_date
ORDER BY event_date;
