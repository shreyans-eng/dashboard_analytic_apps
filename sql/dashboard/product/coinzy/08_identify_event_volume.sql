-- =============================================================================
-- Coinzy MVP #8 — Identify: event volume by screen/action
-- Stages match Camera → crop → after crop → Submit → API started → Success → Details.
-- Identification_done is success, not submit.
-- Identification_attempted is API start.
-- Collection / owned events are Collection-tab actions, not Identify.
-- =============================================================================

WITH bounds AS (
  SELECT
    FORMAT_DATE('%Y%m%d', {{start_date}}) AS start_s,
    FORMAT_DATE('%Y%m%d', {{end_date}}) AS end_s
),
base AS (
  SELECT
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
),
labeled AS (
  SELECT
    resolved_user_id,
    event_name_base,
    CASE
      WHEN event_name_base IN ('Identify_bottom_nav', 'Identify_home') THEN '01_entry_side'
      WHEN event_name_base IN ('Identification_screen', 'photo_screen') THEN '02_camera'
      WHEN event_name_base IN (
        'Camera_permission_popup', 'camera_permission_granted',
        'camer_permission_denied', 'camera_permission_denied'
      ) THEN '03_permission_shutter_only'
      WHEN event_name_base = 'Photo_clicked' THEN '04_shutter'
      WHEN event_name_base IN (
        'photo_cropping_screen_0', 'photo_cropping_screen_1', 'photo_cropping_screen_2',
        'photo_crop_tick_0', 'photo_crop_tick_1', 'photo_crop_tick_2'
      ) THEN '04b_crop_both_paths'
      WHEN event_name_base IN ('photo_clicked_1', 'photo_clicked_2') THEN '05_after_crop_merged'
      WHEN event_name_base IN ('photo_submit_button', 'photos_submitted') THEN '05_submit'
      WHEN event_name_base = 'Identification_attempted' THEN '05b_api_start'
      WHEN event_name_base IN (
        'Identified_limit_reached', 'identiifcation_limit_exceeded', 'free_scan_limit_exceeded',
        'free_scan_blocked', 'free_scan_success_quota_exhausted', 'free_scan_fail_quota_exhausted',
        'Identification_unsuccessful_limit_reached'
      ) THEN '06_quota_side'
      WHEN event_name_base IN (
        'identification_done_success', 'Identification_done_success', 'Identification_done'
      ) THEN '07_success'
      WHEN event_name_base IN (
        'identification_done_failure', 'Identification_done_failure',
        'Identification_failed', 'Identification_unsuccessful'
      ) THEN '07b_failure_side'
      WHEN event_name_base IN (
        'identification_all_options_screen', 'idetnification_option_chosen',
        'identification_option_chosen'
      ) THEN '08_options_side'
      WHEN event_name_base IN (
        'identification_details_screen', 'Coin_details_identification'
      ) THEN '09_details'
      ELSE NULL
    END AS funnel_stage
  FROM base
)
SELECT
  funnel_stage,
  event_name_base,
  COUNT(*) AS event_count,
  COUNT(DISTINCT resolved_user_id) AS unique_users
FROM labeled
WHERE funnel_stage IS NOT NULL
GROUP BY funnel_stage, event_name_base
ORDER BY funnel_stage, event_count DESC;
