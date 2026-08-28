-- =============================================================================
-- Banknote MVP #2 — Same-day first ID (device join)
-- See sql/dashboard/raw/02_time_to_first_scan.sql
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
    user_pseudo_id AS device_id,
    REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS event_name_base
  FROM `{PROJECT}.{DATASET}.events_*`, bounds
  WHERE _TABLE_SUFFIX BETWEEN start_s AND end_s
    AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
    AND user_pseudo_id IS NOT NULL
    AND TRIM(user_pseudo_id) != ''
    [[AND event_country = {{country}}]]
    [[AND event_platform = {{platform}}]]
),
installs AS (
  SELECT
    device_id,
    event_date AS cohort_date,
    MIN(event_ts) AS first_at
  FROM base
  WHERE event_name_base = 'first_open'
     OR STARTS_WITH(event_name_base, 'first_open')
  GROUP BY device_id, event_date
),
same_day_success AS (
  SELECT
    device_id,
    event_date AS success_date,
    MIN(event_ts) AS success_at
  FROM base
  WHERE event_name_base IN ('identification_done_success', 'Identification_done_success')
  GROUP BY device_id, event_date
)
SELECT
  i.cohort_date AS event_date,
  COUNT(*) AS cohort_users,
  COUNTIF(s.device_id IS NOT NULL) AS users_scanned_day0,
  SAFE_DIVIDE(COUNTIF(s.device_id IS NOT NULL), COUNT(*)) AS day0_first_scan_rate,
  APPROX_QUANTILES(
    IF(s.success_at IS NULL, NULL, TIMESTAMP_DIFF(s.success_at, i.first_at, SECOND)),
    100
  )[OFFSET(50)] AS median_seconds_to_first_scan
FROM installs i
LEFT JOIN same_day_success s
  ON i.device_id = s.device_id
 AND i.cohort_date = s.success_date
GROUP BY i.cohort_date
ORDER BY i.cohort_date;
