-- =============================================================================
-- Banknote MVP #8 — Identify funnel (detailed steps + drop-off)
-- Events from Banknote-ai-identification/src/util/analytics.ts (verified)
-- Source: raw events_*  |  strips _android / _ios
-- Grain: one row per funnel step (ordered), users + events + conversion from prior step
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
    user_pseudo_id,
    REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS event_name_base
  FROM `{PROJECT}.{DATASET}.events_*`, bounds
  WHERE _TABLE_SUFFIX BETWEEN start_s AND end_s
    AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
    [[AND event_country = {{country}}]]
    [[AND event_platform = {{platform}}]]
),
-- Distinct users who hit each step (union of aliases where code fires both)
step_users AS (
  SELECT '01_entry_nav' AS step_id, 'Entry: Identify bottom nav' AS step_label, 1 AS step_order,
    COUNT(DISTINCT CASE WHEN event_name_base = 'Identify_bottom_nav' THEN resolved_user_id END) AS users,
    COUNTIF(event_name_base = 'Identify_bottom_nav') AS events
  FROM base
  UNION ALL
  SELECT '01b_entry_home', 'Entry: Identify from Home', 2,
    COUNT(DISTINCT CASE WHEN event_name_base = 'Identify_home' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'Identify_home')
  FROM base
  UNION ALL
  SELECT '02_entry_any', 'Entry: any Identify entry (nav ∪ home)', 3,
    COUNT(DISTINCT CASE WHEN event_name_base IN ('Identify_bottom_nav', 'Identify_home') THEN resolved_user_id END),
    COUNTIF(event_name_base IN ('Identify_bottom_nav', 'Identify_home'))
  FROM base
  UNION ALL
  SELECT '03_camera_screen', 'Screen: Identification / photo camera', 4,
    COUNT(DISTINCT CASE WHEN event_name_base IN ('Identification_screen', 'photo_screen') THEN resolved_user_id END),
    COUNTIF(event_name_base IN ('Identification_screen', 'photo_screen'))
  FROM base
  UNION ALL
  SELECT '04_permission_popup', 'Camera permission popup', 5,
    COUNT(DISTINCT CASE WHEN event_name_base = 'Camera_permission_popup' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'Camera_permission_popup')
  FROM base
  UNION ALL
  SELECT '04b_permission_granted', 'Camera permission granted', 6,
    COUNT(DISTINCT CASE WHEN event_name_base = 'camera_permission_granted' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'camera_permission_granted')
  FROM base
  UNION ALL
  SELECT '04c_permission_denied', 'Camera permission DENIED (drop)', 7,
    COUNT(DISTINCT CASE WHEN event_name_base IN ('camer_permission_denied', 'camera_permission_denied') THEN resolved_user_id END),
    COUNTIF(event_name_base IN ('camer_permission_denied', 'camera_permission_denied'))
  FROM base
  UNION ALL
  SELECT '05_photo_capture', 'Photo captured (slot 1 or 2 / legacy)', 8,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'photo_clicked_1', 'photo_clicked_2', 'Photo_clicked'
    ) THEN resolved_user_id END),
    COUNTIF(event_name_base IN ('photo_clicked_1', 'photo_clicked_2', 'Photo_clicked'))
  FROM base
  UNION ALL
  SELECT '05b_photo_upload', 'Photo uploaded from gallery (slot 1/2)', 9,
    COUNT(DISTINCT CASE WHEN event_name_base IN ('photo_uploaded_1', 'photo_uploaded_2') THEN resolved_user_id END),
    COUNTIF(event_name_base IN ('photo_uploaded_1', 'photo_uploaded_2'))
  FROM base
  UNION ALL
  SELECT '06_crop_screen', 'Crop screen opened', 10,
    COUNT(DISTINCT CASE WHEN event_name_base IN ('photo_cropping_screen_1', 'photo_cropping_screen_2') THEN resolved_user_id END),
    COUNTIF(event_name_base IN ('photo_cropping_screen_1', 'photo_cropping_screen_2'))
  FROM base
  UNION ALL
  SELECT '07_crop_confirm', 'Crop confirmed (tick)', 11,
    COUNT(DISTINCT CASE WHEN event_name_base IN ('photo_crop_tick_1', 'photo_crop_tick_2') THEN resolved_user_id END),
    COUNTIF(event_name_base IN ('photo_crop_tick_1', 'photo_crop_tick_2'))
  FROM base
  UNION ALL
  SELECT '08_submit', 'Photos submitted', 12,
    COUNT(DISTINCT CASE WHEN event_name_base IN ('photo_submit_button', 'photos_submitted') THEN resolved_user_id END),
    COUNTIF(event_name_base IN ('photo_submit_button', 'photos_submitted'))
  FROM base
  UNION ALL
  SELECT '09_quota_block', 'Quota / limit block (drop)', 13,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'Identified_limit_reached', 'identiifcation_limit_exceeded', 'scan_quota_exhausted'
    ) THEN resolved_user_id END),
    COUNTIF(event_name_base IN (
      'Identified_limit_reached', 'identiifcation_limit_exceeded', 'scan_quota_exhausted'
    ))
  FROM base
  UNION ALL
  SELECT '10_success', 'Identification SUCCESS', 14,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'identification_done_success', 'Identification_done_success'
    ) THEN resolved_user_id END),
    COUNTIF(event_name_base IN ('identification_done_success', 'Identification_done_success'))
  FROM base
  UNION ALL
  SELECT '10b_failure', 'Identification FAILURE (drop)', 15,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'identification_done_failure', 'Identification_done_failure'
    ) THEN resolved_user_id END),
    COUNTIF(event_name_base IN ('identification_done_failure', 'Identification_done_failure'))
  FROM base
  UNION ALL
  SELECT '11_top_matches', 'Top matches screen', 16,
    COUNT(DISTINCT CASE WHEN event_name_base = 'identification_top5_matches' THEN resolved_user_id END),
    COUNTIF(event_name_base = 'identification_top5_matches')
  FROM base
  UNION ALL
  SELECT '12_option_chosen', 'Option chosen (typo event name in app)', 17,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'idetnification_option_chosen', 'identification_option_chosen'
    ) THEN resolved_user_id END),
    COUNTIF(event_name_base IN ('idetnification_option_chosen', 'identification_option_chosen'))
  FROM base
  UNION ALL
  SELECT '13_all_options', 'All options screen', 18,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'identification_all_opts_screen', 'identification_all_options_screen'
    ) THEN resolved_user_id END),
    COUNTIF(event_name_base IN (
      'identification_all_opts_screen', 'identification_all_options_screen'
    ))
  FROM base
  UNION ALL
  SELECT '14_details', 'ID details / banknote details after ID', 19,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'identification_details_screen', 'banknote_details_identification'
    ) THEN resolved_user_id END),
    COUNTIF(event_name_base IN (
      'identification_details_screen', 'banknote_details_identification'
    ))
  FROM base
  UNION ALL
  SELECT '15_add_collection', 'Added to collection after identify', 20,
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'Added_to_collection_identified', 'Added_to_collection_owned'
    ) THEN resolved_user_id END),
    COUNTIF(event_name_base IN (
      'Added_to_collection_identified', 'Added_to_collection_owned'
    ))
  FROM base
),
core AS (
  -- Ordered core path for drop-off % (exclude side branches like denied/quota as "prior")
  SELECT * FROM step_users
  WHERE step_id IN (
    '02_entry_any', '03_camera_screen', '05_photo_capture', '06_crop_screen',
    '07_crop_confirm', '08_submit', '10_success'
  )
)
SELECT
  s.step_order,
  s.step_id,
  s.step_label,
  s.users,
  s.events,
  SAFE_DIVIDE(s.users, MAX(IF(s.step_id = '02_entry_any', s.users, NULL)) OVER ()) AS pct_of_entry,
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
