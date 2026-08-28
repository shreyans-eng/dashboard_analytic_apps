-- =============================================================================
-- v_time_to_first_scan
-- Same-day first ID: first_open → identification_done_success on user_pseudo_id.
-- Grain: cohort_date × platform × country
-- Depends on: v_events_normalized
--
-- Do not join on resolved_user_id / COALESCE(user_id, …). Empty-string user_id
-- and login-after-install change user_id between the two events.
-- =============================================================================

CREATE OR REPLACE VIEW `{PROJECT}.{DATASET}.v_time_to_first_scan` AS

WITH installs AS (
  SELECT
    user_pseudo_id AS device_id,
    event_date AS cohort_date,
    platform,
    country,
    MIN(event_timestamp) AS first_at
  FROM `{PROJECT}.{DATASET}.v_events_normalized`
  WHERE user_pseudo_id IS NOT NULL
    AND TRIM(user_pseudo_id) != ''
    AND (
      event_name_base = 'first_open'
      OR STARTS_WITH(event_name_base, 'first_open')
    )
  GROUP BY user_pseudo_id, event_date, platform, country
),
same_day_success AS (
  SELECT
    user_pseudo_id AS device_id,
    event_date AS success_date,
    MIN(event_timestamp) AS success_at
  FROM `{PROJECT}.{DATASET}.v_events_normalized`
  WHERE user_pseudo_id IS NOT NULL
    AND TRIM(user_pseudo_id) != ''
    AND event_name_base IN (
      'identification_done_success',
      'Identification_done_success'
    )
  GROUP BY user_pseudo_id, event_date
),
ever_success AS (
  SELECT
    user_pseudo_id AS device_id,
    MIN(event_date) AS first_success_date,
    MIN(event_timestamp) AS first_success_at
  FROM `{PROJECT}.{DATASET}.v_events_normalized`
  WHERE user_pseudo_id IS NOT NULL
    AND TRIM(user_pseudo_id) != ''
    AND event_name_base IN (
      'identification_done_success',
      'Identification_done_success'
    )
  GROUP BY user_pseudo_id
)

SELECT
  i.cohort_date,
  i.platform,
  i.country,
  COUNT(*) AS cohort_users,
  COUNTIF(e.device_id IS NOT NULL) AS users_ever_scanned,
  COUNTIF(s.device_id IS NOT NULL) AS users_scanned_day0,
  SAFE_DIVIDE(
    COUNTIF(s.device_id IS NOT NULL),
    COUNT(*)
  ) AS day0_first_scan_rate,
  SAFE_DIVIDE(
    COUNTIF(e.device_id IS NOT NULL),
    COUNT(*)
  ) AS ever_scanned_rate,
  APPROX_QUANTILES(
    IF(s.success_at IS NOT NULL AND s.success_at >= i.first_at,
       TIMESTAMP_DIFF(s.success_at, i.first_at, SECOND), NULL),
    100
  )[OFFSET(50)] AS median_seconds_to_first_scan
FROM installs i
LEFT JOIN same_day_success s
  ON i.device_id = s.device_id
 AND i.cohort_date = s.success_date
LEFT JOIN ever_success e
  ON i.device_id = e.device_id
GROUP BY i.cohort_date, i.platform, i.country;
