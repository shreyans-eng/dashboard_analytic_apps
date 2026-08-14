-- =============================================================================
-- Coinzy MVP #8 — Identify: event volume by screen/action (which fires most)
-- Events from CoinzyAndroid CameraScreen / IdentifyViewModel / CoinAnalysisScreen
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
      WHEN event_name_base IN ('Identify_bottom_nav', 'Identify_home') THEN '01_entry'
      WHEN event_name_base IN ('Identification_screen', 'photo_screen') THEN '02_camera_screen'
      WHEN event_name_base IN (
        'Camera_permission_popup', 'camera_permission_granted', 'camera_permission_denied'
      ) THEN '03_permission'
      WHEN event_name_base IN (
        'photo_clicked_1', 'photo_clicked_2', 'Photo_clicked'
      ) THEN '04_capture'
      WHEN event_name_base IN (
        'photo_cropping_screen_0', 'photo_cropping_screen_1', 'photo_cropping_screen_2',
        'photo_crop_tick_0', 'photo_crop_tick_1', 'photo_crop_tick_2'
      ) THEN '05_crop'
      WHEN event_name_base IN (
        'photo_submit_button', 'photos_submitted', 'Identification_done', 'Identification_attempted'
      ) THEN '06_submit'
      WHEN event_name_base IN (
        'Identified_limit_reached', 'free_scan_limit_exceeded', 'free_scan_blocked',
        'free_scan_success_quota_exhausted', 'free_scan_fail_quota_exhausted',
        'Identification_unsuccessful_limit_reached', 'Collection_limit_Reached'
      ) THEN '07_quota'
      WHEN event_name_base IN (
        'identification_done_success', 'Identification_done_success'
      ) THEN '08_success'
      WHEN event_name_base IN (
        'identification_done_failure', 'Identification_done_failure',
        'Identification_failed', 'Identification_unsuccessful'
      ) THEN '09_failure'
      WHEN event_name_base IN (
        'identification_all_options_screen', 'idetnification_option_chosen',
        'identification_option_chosen', 'identification_view_all',
        'identification_details_screen', 'Coin_details_identification'
      ) THEN '10_post_id_ui'
      WHEN STARTS_WITH(event_name_base, 'Added_to_collection')
        OR event_name_base = 'Added _to_collection_owned'
        THEN '11_add_collection'
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
