-- =============================================================================
-- MVP #7 — Identification success rate
-- =============================================================================

SELECT
  event_date,
  SUM(success_events) AS success_events,
  SUM(failure_events) AS failure_events,
  SAFE_DIVIDE(
    SUM(success_events),
    SUM(success_events) + SUM(failure_events)
  ) AS identification_success_rate
FROM `{PROJECT}.{DATASET}.v_identify_metrics`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY event_date
ORDER BY event_date;
