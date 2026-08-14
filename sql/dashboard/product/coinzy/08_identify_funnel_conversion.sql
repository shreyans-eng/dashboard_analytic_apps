-- =============================================================================
-- Coinzy MVP #8 — Identify funnel conversion (raw events)
-- Open: Identify_bottom_nav ∪ Identify_home (CameraScreen / HomeScreen)
-- Photo: photo_clicked_1/2 / Photo_clicked  ·  Submit: photos_submitted / Identification_done
-- =============================================================================

WITH bounds AS (
  SELECT
    FORMAT_DATE('%Y%m%d', {{start_date}}) AS start_s,
    FORMAT_DATE('%Y%m%d', {{end_date}}) AS end_s
),
base AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    COALESCE(
      user_id,
      (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'user_id'),
      user_pseudo_id
    ) AS resolved_user_id,
    REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS event_name_base
  FROM `{PROJECT}.{DATASET}.events_*`, bounds
  WHERE _TABLE_SUFFIX BETWEEN start_s AND end_s
    AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
    [[AND event_country = {{country}}]]
    [[AND event_platform = {{platform}}]]
)
SELECT
  event_date,
  COUNT(DISTINCT CASE WHEN event_name_base IN (
    'Identify_bottom_nav', 'Identify_home', 'Identification_screen'
  ) THEN resolved_user_id END) AS identify_open,
  COUNT(DISTINCT CASE WHEN event_name_base = 'camera_permission_granted' THEN resolved_user_id END)
    AS camera_granted,
  COUNT(DISTINCT CASE WHEN event_name_base = 'camera_permission_denied' THEN resolved_user_id END)
    AS camera_denied,
  COUNT(DISTINCT CASE WHEN event_name_base IN (
    'photo_clicked_1', 'photo_clicked_2', 'Photo_clicked'
  ) THEN resolved_user_id END) AS photo_captured,
  COUNT(DISTINCT CASE WHEN event_name_base IN (
    'photo_submit_button', 'photos_submitted', 'Identification_done'
  ) THEN resolved_user_id END) AS submit,
  COUNT(DISTINCT CASE WHEN event_name_base IN (
    'identification_done_success', 'Identification_done_success'
  ) THEN resolved_user_id END) AS success,
  COUNT(DISTINCT CASE WHEN event_name_base IN (
    'identification_done_failure', 'Identification_done_failure',
    'Identification_failed', 'Identification_unsuccessful'
  ) THEN resolved_user_id END) AS failure,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'identification_done_success', 'Identification_done_success'
    ) THEN resolved_user_id END),
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'Identify_bottom_nav', 'Identify_home', 'Identification_screen'
    ) THEN resolved_user_id END)
  ) AS open_to_success_rate,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'photo_clicked_1', 'photo_clicked_2', 'Photo_clicked'
    ) THEN resolved_user_id END),
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'Identify_bottom_nav', 'Identify_home', 'Identification_screen'
    ) THEN resolved_user_id END)
  ) AS open_to_photo_rate,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'identification_done_success', 'Identification_done_success'
    ) THEN resolved_user_id END),
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'photo_submit_button', 'photos_submitted', 'Identification_done'
    ) THEN resolved_user_id END)
  ) AS submit_to_success_rate,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN event_name_base = 'camera_permission_granted' THEN resolved_user_id END),
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'camera_permission_granted', 'camera_permission_denied'
    ) THEN resolved_user_id END)
  ) AS camera_permission_grant_rate
FROM base
GROUP BY event_date
ORDER BY event_date;
