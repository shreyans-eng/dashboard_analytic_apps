-- =============================================================================
-- v_time_to_first_scan
-- Cohort metric #5: first_open/cohort → first successful identification.
-- Grain: cohort_date × platform × country
-- Depends on: v_events_normalized, v_new_users
-- =============================================================================

CREATE OR REPLACE VIEW `{PROJECT}.{DATASET}.v_time_to_first_scan` AS

WITH first_success AS (
  SELECT
    resolved_user_id,
    MIN(event_timestamp) AS first_success_at,
    MIN(event_date) AS first_success_date
  FROM `{PROJECT}.{DATASET}.v_events_normalized`
  WHERE resolved_user_id IS NOT NULL
    AND event_name_base IN (
      'identification_done_success',
      'Identification_done_success'
    )
  GROUP BY resolved_user_id
),

cohort AS (
  SELECT
    n.resolved_user_id,
    n.cohort_date,
    n.first_seen_at,
    n.first_platform AS platform,
    n.first_country AS country,
    f.first_success_at,
    f.first_success_date,
    TIMESTAMP_DIFF(f.first_success_at, n.first_seen_at, SECOND) AS seconds_to_first_scan
  FROM `{PROJECT}.{DATASET}.v_new_users` n
  LEFT JOIN first_success f
    ON n.resolved_user_id = f.resolved_user_id
  WHERE n.cohort_date IS NOT NULL
)

SELECT
  cohort_date,
  platform,
  country,
  COUNT(*) AS cohort_users,
  COUNTIF(first_success_date IS NOT NULL) AS users_ever_scanned,
  COUNTIF(first_success_date = cohort_date) AS users_scanned_day0,
  SAFE_DIVIDE(
    COUNTIF(first_success_date = cohort_date),
    COUNT(*)
  ) AS day0_first_scan_rate,
  SAFE_DIVIDE(
    COUNTIF(first_success_date IS NOT NULL),
    COUNT(*)
  ) AS ever_scanned_rate,
  APPROX_QUANTILES(
    IF(seconds_to_first_scan IS NOT NULL AND seconds_to_first_scan >= 0,
       seconds_to_first_scan, NULL),
    100
  )[OFFSET(50)] AS median_seconds_to_first_scan
FROM cohort
GROUP BY cohort_date, platform, country;
