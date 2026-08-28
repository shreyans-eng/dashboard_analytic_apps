-- =============================================================================
-- Banknote MVP #2 — Time to first scan (raw events)
-- v_time_to_first_scan is not deployed; same grain as Coinzy raw query.
-- Cohort: first_open. Success: identification_done_success
-- =============================================================================

WITH bounds AS (
  SELECT
    FORMAT_DATE('%Y%m%d', {{start_date}}) AS start_s,
    FORMAT_DATE('%Y%m%d', {{end_date}}) AS end_s
),
base AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    TIMESTAMP_MICROS(event_timestamp) AS event_ts,
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
cohorts AS (
  SELECT
    resolved_user_id,
    MIN(event_date) AS cohort_date,
    MIN(event_ts) AS first_at
  FROM base
  WHERE event_name_base IN ('first_open', 'first_open_android', 'first_open_ios')
     OR STARTS_WITH(event_name_base, 'first_open')
  GROUP BY resolved_user_id
),
first_success AS (
  SELECT
    resolved_user_id,
    MIN(event_date) AS success_date,
    MIN(event_ts) AS success_at
  FROM base
  WHERE event_name_base IN ('identification_done_success', 'Identification_done_success')
  GROUP BY resolved_user_id
)
SELECT
  c.cohort_date AS event_date,
  COUNT(*) AS cohort_users,
  COUNTIF(s.success_date = c.cohort_date) AS users_scanned_day0,
  SAFE_DIVIDE(COUNTIF(s.success_date = c.cohort_date), COUNT(*)) AS day0_first_scan_rate,
  APPROX_QUANTILES(
    IF(s.success_at IS NULL, NULL, TIMESTAMP_DIFF(s.success_at, c.first_at, SECOND)),
    100
  )[OFFSET(50)] AS median_seconds_to_first_scan
FROM cohorts c
LEFT JOIN first_success s USING (resolved_user_id)
GROUP BY c.cohort_date
ORDER BY c.cohort_date;
