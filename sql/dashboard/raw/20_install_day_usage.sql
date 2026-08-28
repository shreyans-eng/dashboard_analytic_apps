-- =============================================================================
-- Install day usage
-- Installs = distinct devices (user_pseudo_id) with first_open that calendar day.
-- Went in  = those devices with >= 10 seconds in the app that same day
--            (Firebase user_engagement.engagement_time_msec, else session_length_seconds).
-- Time     = seconds in the app on the install day (among those who went in).
-- Do not join on user_id — same reason as same-day first ID.
-- =============================================================================

WITH bounds AS (
  SELECT
    FORMAT_DATE('%Y%m%d', {{start_date}}) AS start_s,
    FORMAT_DATE('%Y%m%d', {{end_date}}) AS end_s
),
base AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    user_pseudo_id AS device_id,
    REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS event_name_base,
    (SELECT ep.value.int_value FROM UNNEST(event_params) ep WHERE ep.key = 'engagement_time_msec')
      AS engagement_time_msec,
    (SELECT ep.value.int_value FROM UNNEST(event_params) ep WHERE ep.key = 'session_length_seconds')
      AS session_length_seconds
  FROM `{PROJECT}.{DATASET}.events_*`, bounds
  WHERE _TABLE_SUFFIX BETWEEN start_s AND end_s
    AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
    AND user_pseudo_id IS NOT NULL
    AND TRIM(user_pseudo_id) != ''
    AND (
      STARTS_WITH(REGEXP_REPLACE(event_name, r'_(android|ios)$', ''), 'first_open')
      OR REGEXP_REPLACE(event_name, r'_(android|ios)$', '') IN (
        'session_start', 'App_open', 'user_engagement'
      )
    )
    [[AND event_country = {{country}}]]
    [[AND event_platform = {{platform}}]]
),
per_device_day AS (
  SELECT
    device_id,
    event_date,
    COUNTIF(
      event_name_base = 'first_open'
      OR STARTS_WITH(event_name_base, 'first_open')
    ) > 0 AS is_install,
    IFNULL(SUM(IF(event_name_base = 'user_engagement', engagement_time_msec, 0)), 0) / 1000.0
      AS engagement_seconds,
    IFNULL(MAX(session_length_seconds), 0) AS session_length_seconds
  FROM base
  GROUP BY device_id, event_date
),
installers AS (
  SELECT
    device_id,
    event_date,
    GREATEST(engagement_seconds, session_length_seconds) AS time_seconds
  FROM per_device_day
  WHERE is_install
)
SELECT
  event_date,
  COUNT(*) AS installs,
  COUNTIF(time_seconds >= 10) AS went_in,
  SAFE_DIVIDE(COUNTIF(time_seconds >= 10), COUNT(*)) AS went_in_rate,
  SUM(IF(time_seconds >= 10, time_seconds, 0)) AS total_seconds_went_in,
  AVG(IF(time_seconds >= 10, time_seconds, NULL)) AS avg_seconds,
  APPROX_QUANTILES(
    IF(time_seconds >= 10, time_seconds, NULL),
    100
  )[OFFSET(50)] AS median_seconds
FROM installers
GROUP BY event_date
ORDER BY event_date;
