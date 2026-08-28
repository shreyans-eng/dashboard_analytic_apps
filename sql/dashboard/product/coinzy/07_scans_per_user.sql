-- =============================================================================
-- Coinzy MVP #7 — Scans per active user (raw events)
-- Mean among everyone with any event that day, plus P10–P99 among people
-- who got at least one successful ID.
-- =============================================================================

WITH bounds AS (
  SELECT
    FORMAT_DATE('%Y%m%d', {{start_date}}) AS start_s,
    FORMAT_DATE('%Y%m%d', {{end_date}}) AS end_s
),
base AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
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
user_day AS (
  SELECT
    event_date,
    resolved_user_id,
    COUNTIF(event_name_base IN (
      'identification_done_success', 'Identification_done_success'
    )) AS scans
  FROM base
  WHERE resolved_user_id IS NOT NULL
  GROUP BY event_date, resolved_user_id
),
daily AS (
  SELECT
    event_date,
    COUNT(*) AS dau,
    SUM(scans) AS success_scans,
    COUNTIF(scans > 0) AS users_with_scan,
    SAFE_DIVIDE(SUM(scans), COUNT(*)) AS scans_per_dau,
    SAFE_DIVIDE(SUM(scans), COUNTIF(scans > 0)) AS scans_per_scanning_user,
    APPROX_QUANTILES(IF(scans > 0, scans, NULL), 100) AS q
  FROM user_day
  GROUP BY event_date
)
SELECT
  event_date,
  dau,
  success_scans,
  users_with_scan,
  scans_per_dau,
  scans_per_scanning_user,
  q[OFFSET(10)] AS scans_p10,
  q[OFFSET(25)] AS scans_p25,
  q[OFFSET(50)] AS scans_p50,
  q[OFFSET(75)] AS scans_p75,
  q[OFFSET(90)] AS scans_p90,
  q[OFFSET(95)] AS scans_p95,
  q[OFFSET(99)] AS scans_p99
FROM daily
ORDER BY event_date;
