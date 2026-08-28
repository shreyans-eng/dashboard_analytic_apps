-- =============================================================================
-- Coinzy MVP #8 — Identify funnel (detailed steps)
-- Real funnel: Camera → (shutter ∥ gallery) → after-crop merge → Submit → ID success → Details
-- Gallery tap has no event; gallery-only = crop/clicked minus Photo_clicked.
-- Photo_clicked is shutter only. photo_clicked_1/2 fire after crop on both paths.
-- Identify_bottom_nav also fires when camera opens from Home — not a clean start.
-- Crop is 0-based; photo_clicked_1/2 fire after crop, not at shutter.
-- Identification_attempted is API start, not submit.
-- Identification_done is success (same flow as identification_done_success).
-- Quota / permission / Learn more / owned / collection are not sequential Identify steps.
-- Add-to-collection has no live Firebase success event.
-- Grain: one row per step; % of camera (not nav ∪ home)
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
path_users AS (
  SELECT
    resolved_user_id,
    COUNTIF(event_name_base = 'Photo_clicked') > 0 AS shutter,
    COUNTIF(event_name_base IN (
      'photo_cropping_screen_0', 'photo_crop_tick_0', 'photo_clicked_1',
      'photo_cropping_screen_1', 'photo_crop_tick_1', 'photo_clicked_2'
    )) > 0 AS crop_or_clicked,
    COUNTIF(event_name_base IN ('photo_clicked_1', 'photo_clicked_2')) > 0 AS after_crop
  FROM base
  GROUP BY resolved_user_id
),
step_users AS (
  SELECT '01_nav_or_home' AS step_id, 'Nav / home tap (nav also fires from Home)' AS step_label, 1 AS step_order,
    COUNT(DISTINCT CASE WHEN event_name_base IN ('Identify_bottom_nav', 'Identify_home') THEN resolved_user_id END) AS users,
    COUNTIF(event_name_base IN ('Identify_bottom_nav', 'Identify_home')) AS events
  FROM base
  UNION ALL
  SELECT '01b_home_cta', 'Home / banner Identify CTA', 2,
    COUNT(DISTINCT CASE WHEN event_name_base = 'Identify_home' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'Identify_home')
  FROM base
  UNION ALL
  SELECT '02_camera', 'Camera / photo screen (funnel start)', 3,
    COUNT(DISTINCT CASE WHEN event_name_base IN ('Identification_screen', 'photo_screen') THEN resolved_user_id END),
    COUNTIF(event_name_base IN ('Identification_screen', 'photo_screen'))
  FROM base
  UNION ALL
  SELECT '03_permission_popup', 'In-app camera permission (shutter-only; gallery can skip)', 4,
    COUNT(DISTINCT CASE WHEN event_name_base = 'Camera_permission_popup' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'Camera_permission_popup')
  FROM base
  UNION ALL
  SELECT '03b_permission_granted', 'OS camera permission granted (shutter-only)', 5,
    COUNT(DISTINCT CASE WHEN event_name_base = 'camera_permission_granted' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'camera_permission_granted')
  FROM base
  UNION ALL
  SELECT '03c_permission_denied', 'OS camera permission denied (shutter-only)', 6,
    COUNT(DISTINCT CASE WHEN event_name_base IN ('camer_permission_denied', 'camera_permission_denied') THEN resolved_user_id END),
    COUNTIF(event_name_base IN ('camer_permission_denied', 'camera_permission_denied'))
  FROM base
  UNION ALL
  SELECT '04_shutter', 'Camera shutter', 7,
    COUNTIF(shutter),
    NULL
  FROM path_users
  UNION ALL
  SELECT '04b_gallery', 'Gallery pick (inferred: crop/clicked, never shutter)', 8,
    COUNTIF(crop_or_clicked AND NOT shutter),
    NULL
  FROM path_users
  UNION ALL
  SELECT '05_photos', 'After crop (both paths)', 9,
    COUNTIF(after_crop),
    NULL
  FROM path_users
  UNION ALL
  SELECT '05b_crop_1', 'First crop screen (index 0) — camera or gallery', 10,
    COUNT(DISTINCT CASE WHEN event_name_base = 'photo_cropping_screen_0' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'photo_cropping_screen_0')
  FROM base
  UNION ALL
  SELECT '05c_crop_confirm_1', 'First crop confirmed (manual only; auto-crop skips)', 11,
    COUNT(DISTINCT CASE WHEN event_name_base = 'photo_crop_tick_0' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'photo_crop_tick_0')
  FROM base
  UNION ALL
  SELECT '05d_photo_click_1', 'First photo after crop (both paths)', 12,
    COUNT(DISTINCT CASE WHEN event_name_base = 'photo_clicked_1' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'photo_clicked_1')
  FROM base
  UNION ALL
  SELECT '05e_crop_2', 'Second crop screen (index 1) — camera or gallery', 13,
    COUNT(DISTINCT CASE WHEN event_name_base = 'photo_cropping_screen_1' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'photo_cropping_screen_1')
  FROM base
  UNION ALL
  SELECT '05f_crop_confirm_2', 'Second crop confirmed (manual only; auto-crop skips)', 14,
    COUNT(DISTINCT CASE WHEN event_name_base = 'photo_crop_tick_1' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'photo_crop_tick_1')
  FROM base
  UNION ALL
  SELECT '05g_photo_click_2', 'Second photo after crop (both paths)', 15,
    COUNT(DISTINCT CASE WHEN event_name_base = 'photo_clicked_2' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'photo_clicked_2')
  FROM base
  UNION ALL
  SELECT '06_submit', 'Submit photos', 16,
    COUNT(DISTINCT CASE WHEN event_name_base IN ('photo_submit_button', 'photos_submitted') THEN resolved_user_id END),
    COUNTIF(event_name_base IN ('photo_submit_button', 'photos_submitted'))
  FROM base
  UNION ALL
  SELECT '06b_attempt', 'API started (not submit)', 17,
    COUNT(DISTINCT CASE WHEN event_name_base = 'Identification_attempted' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'Identification_attempted')
  FROM base
  UNION ALL
  SELECT '07_quota', 'Quota / limit (side branch)', 18,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'Identified_limit_reached', 'identiifcation_limit_exceeded', 'free_scan_limit_exceeded',
      'free_scan_blocked', 'free_scan_success_quota_exhausted', 'free_scan_fail_quota_exhausted',
      'Identification_unsuccessful_limit_reached'
    ) THEN resolved_user_id END),
    COUNTIF(event_name_base IN (
      'Identified_limit_reached', 'identiifcation_limit_exceeded', 'free_scan_limit_exceeded',
      'free_scan_blocked', 'free_scan_success_quota_exhausted', 'free_scan_fail_quota_exhausted',
      'Identification_unsuccessful_limit_reached'
    ))
  FROM base
  UNION ALL
  SELECT '08_success', 'Identification success', 19,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'identification_done_success', 'Identification_done_success', 'Identification_done'
    ) THEN resolved_user_id END),
    COUNTIF(event_name_base IN (
      'identification_done_success', 'Identification_done_success', 'Identification_done'
    ))
  FROM base
  UNION ALL
  SELECT '08b_failure', 'Identification failure (side branch)', 20,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'identification_done_failure', 'Identification_done_failure',
      'Identification_failed', 'Identification_unsuccessful'
    ) THEN resolved_user_id END),
    COUNTIF(event_name_base IN (
      'identification_done_failure', 'Identification_done_failure',
      'Identification_failed', 'Identification_unsuccessful'
    ))
  FROM base
  UNION ALL
  SELECT '09_all_options', 'All options screen', 21,
    COUNT(DISTINCT CASE WHEN event_name_base = 'identification_all_options_screen' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'identification_all_options_screen')
  FROM base
  UNION ALL
  SELECT '09b_option_chosen', 'Learn more / option chosen (optional)', 22,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'idetnification_option_chosen', 'identification_option_chosen'
    ) THEN resolved_user_id END),
    COUNTIF(event_name_base IN ('idetnification_option_chosen', 'identification_option_chosen'))
  FROM base
  UNION ALL
  SELECT '10_details', 'ID / coin details', 23,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'identification_details_screen', 'Coin_details_identification'
    ) THEN resolved_user_id END),
    COUNTIF(event_name_base IN (
      'identification_details_screen', 'Coin_details_identification'
    ))
  FROM base
)
SELECT
  s.step_order,
  s.step_id,
  s.step_label,
  s.users,
  s.events,
  SAFE_DIVIDE(s.users, MAX(IF(s.step_id = '02_camera', s.users, NULL)) OVER ()) AS pct_of_entry,
  LAG(s.users) OVER (ORDER BY s.step_order) AS prev_step_users,
  SAFE_DIVIDE(
    s.users,
    LAG(s.users) OVER (ORDER BY s.step_order)
  ) AS pct_of_previous_step,
  1 - SAFE_DIVIDE(
    s.users,
    LAG(s.users) OVER (ORDER BY s.step_order)
  ) AS drop_off_from_previous
FROM step_users s
ORDER BY s.step_order;
