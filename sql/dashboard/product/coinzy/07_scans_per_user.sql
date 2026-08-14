-- =============================================================================
-- Coinzy MVP #7 — Scans per active user (raw events)
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
)
SELECT
  event_date,
  COUNT(DISTINCT resolved_user_id) AS dau,
  COUNTIF(event_name_base IN (
    'identification_done_success', 'Identification_done_success'
  )) AS success_scans,
  SAFE_DIVIDE(
    COUNTIF(event_name_base IN (
      'identification_done_success', 'Identification_done_success'
    )),
    COUNT(DISTINCT resolved_user_id)
  ) AS scans_per_dau,
  SAFE_DIVIDE(
    COUNTIF(event_name_base IN (
      'identification_done_success', 'Identification_done_success'
    )),
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'identification_done_success', 'Identification_done_success'
    ) THEN resolved_user_id END)
  ) AS scans_per_scanning_user
FROM base
GROUP BY event_date
ORDER BY event_date;
