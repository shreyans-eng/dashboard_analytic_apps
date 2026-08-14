-- =============================================================================
-- MVP #8 — Identify funnel conversion (open → success)
-- Covers missing "funnels" ask: where Identify breaks.
-- =============================================================================

SELECT
  event_date,
  SUM(users_identify_open) AS identify_open,
  SUM(users_camera_granted) AS camera_granted,
  SUM(users_camera_denied) AS camera_denied,
  SUM(users_photo_captured) AS photo_captured,
  SUM(users_submit) AS submit,
  SUM(users_success) AS success,
  SUM(users_failure) AS failure,
  SAFE_DIVIDE(SUM(users_success), SUM(users_identify_open)) AS open_to_success_rate,
  SAFE_DIVIDE(SUM(users_photo_captured), SUM(users_identify_open)) AS open_to_photo_rate,
  SAFE_DIVIDE(SUM(users_success), SUM(users_submit)) AS submit_to_success_rate,
  SAFE_DIVIDE(SUM(users_camera_granted), SUM(users_camera_granted) + SUM(users_camera_denied))
    AS camera_permission_grant_rate
FROM `{PROJECT}.{DATASET}.v_identify_metrics`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY event_date
ORDER BY event_date;
