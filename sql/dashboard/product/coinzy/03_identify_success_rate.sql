-- =============================================================================
-- Coinzy MVP #3 — Identification success rate (raw events)
-- Success / failure from CoinAnalysisScreen.kt
-- =============================================================================

WITH bounds AS (
  SELECT
    FORMAT_DATE('%Y%m%d', {{start_date}}) AS start_s,
    FORMAT_DATE('%Y%m%d', {{end_date}}) AS end_s
),
base AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS event_name_base
  FROM `{PROJECT}.{DATASET}.events_*`, bounds
  WHERE _TABLE_SUFFIX BETWEEN start_s AND end_s
    AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
    [[AND event_country = {{country}}]]
    [[AND event_platform = {{platform}}]]
)
SELECT
  event_date,
  COUNTIF(event_name_base IN ('identification_done_success', 'Identification_done_success')) AS success_events,
  COUNTIF(event_name_base IN (
    'identification_done_failure', 'Identification_done_failure',
    'Identification_failed', 'Identification_unsuccessful'
  )) AS failure_events,
  SAFE_DIVIDE(
    COUNTIF(event_name_base IN ('identification_done_success', 'Identification_done_success')),
    COUNTIF(event_name_base IN (
      'identification_done_success', 'Identification_done_success',
      'identification_done_failure', 'Identification_done_failure',
      'Identification_failed', 'Identification_unsuccessful'
    ))
  ) AS identification_success_rate
FROM base
GROUP BY event_date
ORDER BY event_date;
