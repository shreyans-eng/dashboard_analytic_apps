-- =============================================================================
-- v_identify_metrics
-- Daily Identify funnel + quality + quota pressure for Banknote.
-- Metrics: #6 funnel, #7 success, #8 no-match, #9 quota, #19 camera permission
-- (Time-to-first-scan is v_time_to_first_scan — separate grain.)
-- Depends on: v_events_normalized
-- =============================================================================

CREATE OR REPLACE VIEW `{PROJECT}.{DATASET}.v_identify_metrics` AS

WITH events AS (
  SELECT
    event_date,
    platform,
    country,
    app_version,
    resolved_user_id,
    event_name_base,
    option_number
  FROM `{PROJECT}.{DATASET}.v_events_normalized`
  WHERE resolved_user_id IS NOT NULL
),

daily_funnel AS (
  SELECT
    event_date,
    platform,
    country,
    app_version,

    COUNT(DISTINCT CASE
      WHEN event_name_base IN (
        -- App-verified entry (Banknote + Coinzy)
        'Identify_bottom_nav', 'Identify_home', 'Identification_screen',
        -- Legacy preferred aliases
        'Identify_open', 'Identify', 'identify_open', 'Identification_open',
        'camera_opened', 'Camera_open'
      ) THEN resolved_user_id END) AS users_identify_open,

    COUNT(DISTINCT CASE
      WHEN event_name_base IN (
        'camera_permission_granted', 'Camera_permission_granted',
        'permission_camera_granted'
      ) THEN resolved_user_id END) AS users_camera_granted,

    COUNT(DISTINCT CASE
      WHEN event_name_base IN (
        'camera_permission_denied', 'Camera_permission_denied',
        'permission_camera_denied', 'camer_permission_denied'
      ) THEN resolved_user_id END) AS users_camera_denied,

    COUNT(DISTINCT CASE
      WHEN event_name_base IN (
        'photo_clicked_1', 'photo_clicked_2', 'Photo_clicked',
        'photo_captured', 'Photo_captured', 'photo_taken', 'Image_captured'
      ) THEN resolved_user_id END) AS users_photo_captured,

    COUNT(DISTINCT CASE
      WHEN event_name_base IN (
        'photo_submit_button', 'photos_submitted',
        'identification_submit', 'Identification_submit', 'Identification_done'
      ) THEN resolved_user_id END) AS users_submit,

    COUNT(DISTINCT CASE
      WHEN event_name_base IN (
        'identification_done_success', 'Identification_done_success'
      ) THEN resolved_user_id END) AS users_success,

    COUNT(DISTINCT CASE
      WHEN event_name_base IN (
        'identification_done_failure', 'Identification_done_failure'
      ) THEN resolved_user_id END) AS users_failure,

    COUNTIF(event_name_base IN (
      'identification_done_success', 'Identification_done_success'
    )) AS success_events,

    COUNTIF(event_name_base IN (
      'identification_done_failure', 'Identification_done_failure'
    )) AS failure_events,

    COUNTIF(event_name_base IN (
      'identification_report_no_match', 'Identification_report_no_match',
      'no_match', 'Identification_no_match'
    )) AS no_match_events,

    COUNTIF(event_name_base IN (
      'Identification_view_all', 'identification_view_all',
      'view_all_options'
    )) AS view_all_events,

    COUNTIF(
      event_name_base IN (
        'Identification_option_selected', 'identification_option_selected',
        'idetnification_option_chosen', 'identification_option_chosen'
      )
      OR option_number IS NOT NULL
    ) AS multi_option_events,

    COUNTIF(event_name_base IN (
      'Identified_limit_reached', 'identified_limit_reached',
      'identiifcation_limit_exceeded', 'identification_limit_exceeded',
      'scan_quota_exhausted', 'Scan_quota_exhausted', 'limit_exceeded', 'Limit_exceeded',
      'free_scan_limit_exceeded', 'free_scan_blocked',
      'free_scan_success_quota_exhausted',
      'Identification_unsuccessful_limit_reached'
    )) AS quota_hit_events,

    COUNT(DISTINCT CASE
      WHEN event_name_base IN (
        'Identified_limit_reached', 'identified_limit_reached',
        'identiifcation_limit_exceeded', 'identification_limit_exceeded',
        'scan_quota_exhausted', 'Scan_quota_exhausted',
        'limit_exceeded', 'Limit_exceeded',
        'free_scan_limit_exceeded', 'free_scan_blocked',
        'free_scan_success_quota_exhausted',
        'Identification_unsuccessful_limit_reached'
      ) THEN resolved_user_id END) AS users_hit_quota,

    COUNT(DISTINCT CASE
      WHEN event_name_base IN (
        'identification_done_success', 'Identification_done_success',
        'identification_done_failure', 'Identification_done_failure',
        'Identification_done'
      ) THEN resolved_user_id END) AS users_attempted_scan

  FROM events
  GROUP BY event_date, platform, country, app_version
)

SELECT
  *,
  SAFE_DIVIDE(success_events, success_events + failure_events)
    AS identification_success_rate,
  SAFE_DIVIDE(no_match_events, success_events + failure_events + no_match_events)
    AS no_match_rate,
  SAFE_DIVIDE(view_all_events + multi_option_events, NULLIF(success_events, 0))
    AS distrust_signal_rate,
  SAFE_DIVIDE(users_hit_quota, users_attempted_scan)
    AS free_quota_hit_rate,
  SAFE_DIVIDE(users_camera_granted, users_camera_granted + users_camera_denied)
    AS camera_permission_grant_rate,
  SAFE_DIVIDE(users_success, users_identify_open) AS identify_open_to_success_rate,
  SAFE_DIVIDE(users_photo_captured, users_identify_open) AS identify_open_to_photo_rate,
  SAFE_DIVIDE(users_success, users_submit) AS submit_to_success_rate
FROM daily_funnel;
