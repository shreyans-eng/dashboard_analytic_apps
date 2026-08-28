-- =============================================================================
-- Install cohort D0 / D1 percentiles
-- Cohort = devices (user_pseudo_id) with first_open that calendar day.
-- D0 = install day. D1 = the next calendar day.
--
-- Retain:
--   D0 went in = ≥10 seconds in the app that day (same as Installs + time used)
--   D1 returned = opened the app (session_start / App_open / first_open / user_engagement)
--     — not MVP 6 (any Firebase event, including push)
--
-- Time percentiles: seconds among people who went in (≥10s) that day.
-- Scan percentiles: successful IDs among people who got ≥1 success that day.
--   Banknote: identification_done_success
--   Coinzy: identification_done_success ∪ Identification_done
--
-- P10 P25 P50 P75 P90 P95 P99
-- =============================================================================

WITH bounds AS (
  SELECT
    {{start_date}} AS start_d,
    {{end_date}} AS end_d,
    DATE_ADD({{end_date}}, INTERVAL 1 DAY) AS activity_end,
    FORMAT_DATE('%Y%m%d', {{start_date}}) AS start_s,
    FORMAT_DATE('%Y%m%d', DATE_ADD({{end_date}}, INTERVAL 1 DAY)) AS activity_end_s
),
base AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    user_pseudo_id AS uid,
    REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS ev,
    (SELECT ep.value.int_value FROM UNNEST(event_params) ep WHERE ep.key = 'engagement_time_msec')
      AS engagement_time_msec,
    (SELECT ep.value.int_value FROM UNNEST(event_params) ep WHERE ep.key = 'session_length_seconds')
      AS session_length_seconds
  FROM `{PROJECT}.{DATASET}.events_*`, bounds
  WHERE _TABLE_SUFFIX BETWEEN start_s AND activity_end_s
    AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
    AND user_pseudo_id IS NOT NULL
    AND TRIM(user_pseudo_id) != ''
    AND (
      STARTS_WITH(REGEXP_REPLACE(event_name, r'_(android|ios)$', ''), 'first_open')
      OR REGEXP_REPLACE(event_name, r'_(android|ios)$', '') IN (
        'session_start', 'App_open', 'user_engagement',
        'identification_done_success', 'Identification_done_success',
        'Identification_done'
      )
    )
    [[AND event_country = {{country}}]]
    [[AND event_platform = {{platform}}]]
),
per_user_day AS (
  SELECT
    uid,
    event_date,
    COUNTIF(ev = 'first_open' OR STARTS_WITH(ev, 'first_open')) > 0 AS is_install,
    GREATEST(
      IFNULL(SUM(IF(ev = 'user_engagement', engagement_time_msec, 0)), 0) / 1000.0,
      IFNULL(MAX(session_length_seconds), 0)
    ) AS time_seconds,
    COUNTIF(ev IN (
      'identification_done_success', 'Identification_done_success', 'Identification_done'
    )) AS scans,
    COUNTIF(ev IN ('session_start', 'App_open', 'first_open', 'user_engagement')
      OR STARTS_WITH(ev, 'first_open')) > 0 AS opened
  FROM base
  GROUP BY uid, event_date
),
installers AS (
  SELECT
    uid,
    event_date AS cohort_date
  FROM per_user_day
  WHERE is_install
),
flags AS (
  SELECT
    i.cohort_date,
    i.uid,
    IFNULL(d0.time_seconds, 0) AS d0_seconds,
    IFNULL(d0.scans, 0) AS d0_scans,
    IFNULL(d1.time_seconds, 0) AS d1_seconds,
    IFNULL(d1.scans, 0) AS d1_scans,
    IFNULL(d1.opened, FALSE) AS d1_returned
  FROM installers i
  CROSS JOIN bounds b
  LEFT JOIN per_user_day d0
    ON d0.uid = i.uid AND d0.event_date = i.cohort_date
  LEFT JOIN per_user_day d1
    ON d1.uid = i.uid AND d1.event_date = DATE_ADD(i.cohort_date, INTERVAL 1 DAY)
  WHERE i.cohort_date BETWEEN b.start_d AND b.end_d
    AND DATE_ADD(i.cohort_date, INTERVAL 1 DAY) <= CURRENT_DATE()
),
daily AS (
  SELECT
    cohort_date,
    COUNT(*) AS installs,
    COUNTIF(d0_seconds >= 10) AS d0_went_in,
    COUNTIF(d1_returned) AS d1_retained,
    COUNTIF(d0_scans > 0) AS d0_scanners,
    COUNTIF(d1_scans > 0) AS d1_scanners,
    SAFE_DIVIDE(COUNTIF(d0_seconds >= 10), COUNT(*)) AS d0_went_in_rate,
    SAFE_DIVIDE(COUNTIF(d1_returned), COUNT(*)) AS d1_retention_rate,
    AVG(d0_scans) AS d0_scans_per_install,
    AVG(IF(d1_returned, d1_scans, 0)) AS d1_scans_per_install,
    APPROX_QUANTILES(IF(d0_seconds >= 10, d0_seconds, NULL), 100) AS d0_time_q,
    APPROX_QUANTILES(IF(d1_returned AND d1_seconds >= 10, d1_seconds, NULL), 100) AS d1_time_q,
    APPROX_QUANTILES(IF(d0_scans > 0, d0_scans, NULL), 100) AS d0_scans_q,
    APPROX_QUANTILES(IF(d1_scans > 0, d1_scans, NULL), 100) AS d1_scans_q
  FROM flags
  GROUP BY cohort_date
)
SELECT
  cohort_date,
  installs,
  d0_went_in,
  d0_went_in_rate,
  d1_retained,
  d1_retention_rate,
  d0_scanners,
  d1_scanners,
  d0_scans_per_install,
  d1_scans_per_install,
  d0_time_q[OFFSET(10)] AS d0_time_p10,
  d0_time_q[OFFSET(25)] AS d0_time_p25,
  d0_time_q[OFFSET(50)] AS d0_time_p50,
  d0_time_q[OFFSET(75)] AS d0_time_p75,
  d0_time_q[OFFSET(90)] AS d0_time_p90,
  d0_time_q[OFFSET(95)] AS d0_time_p95,
  d0_time_q[OFFSET(99)] AS d0_time_p99,
  d1_time_q[OFFSET(10)] AS d1_time_p10,
  d1_time_q[OFFSET(25)] AS d1_time_p25,
  d1_time_q[OFFSET(50)] AS d1_time_p50,
  d1_time_q[OFFSET(75)] AS d1_time_p75,
  d1_time_q[OFFSET(90)] AS d1_time_p90,
  d1_time_q[OFFSET(95)] AS d1_time_p95,
  d1_time_q[OFFSET(99)] AS d1_time_p99,
  d0_scans_q[OFFSET(10)] AS d0_scans_p10,
  d0_scans_q[OFFSET(25)] AS d0_scans_p25,
  d0_scans_q[OFFSET(50)] AS d0_scans_p50,
  d0_scans_q[OFFSET(75)] AS d0_scans_p75,
  d0_scans_q[OFFSET(90)] AS d0_scans_p90,
  d0_scans_q[OFFSET(95)] AS d0_scans_p95,
  d0_scans_q[OFFSET(99)] AS d0_scans_p99,
  d1_scans_q[OFFSET(10)] AS d1_scans_p10,
  d1_scans_q[OFFSET(25)] AS d1_scans_p25,
  d1_scans_q[OFFSET(50)] AS d1_scans_p50,
  d1_scans_q[OFFSET(75)] AS d1_scans_p75,
  d1_scans_q[OFFSET(90)] AS d1_scans_p90,
  d1_scans_q[OFFSET(95)] AS d1_scans_p95,
  d1_scans_q[OFFSET(99)] AS d1_scans_p99
FROM daily
ORDER BY cohort_date;
