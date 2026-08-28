-- =============================================================================
-- Coinzy MVP #4 — Quota hit rate (raw events)
-- Identified_limit_reached + free_scan_* from FreeScanLimitUtil.kt / ExperimentUtil.kt
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
  COUNT(DISTINCT CASE WHEN event_name_base IN (
    'Identified_limit_reached', 'identified_limit_reached',
    'free_scan_limit_exceeded', 'free_scan_blocked',
    'free_scan_success_quota_exhausted', 'free_scan_fail_quota_exhausted',
    'Identification_unsuccessful_limit_reached',
    'identiifcation_limit_exceeded',
    'scan_quota_exhausted', 'limit_exceeded'
  ) THEN resolved_user_id END) AS users_hit_quota,
  COUNT(DISTINCT CASE WHEN event_name_base IN (
    'identification_done_success', 'Identification_done_success',
    'identification_done_failure', 'Identification_done_failure',
    'Identification_failed', 'Identification_unsuccessful',
    'Identification_done'
  ) THEN resolved_user_id END) AS users_attempted_scan,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'Identified_limit_reached', 'identified_limit_reached',
      'free_scan_limit_exceeded', 'free_scan_blocked',
      'free_scan_success_quota_exhausted', 'free_scan_fail_quota_exhausted',
      'Identification_unsuccessful_limit_reached',
      'identiifcation_limit_exceeded',
      'scan_quota_exhausted', 'limit_exceeded'
    ) THEN resolved_user_id END),
    COUNT(DISTINCT CASE WHEN event_name_base IN (
      'identification_done_success', 'Identification_done_success',
      'identification_done_failure', 'Identification_done_failure',
      'Identification_failed', 'Identification_unsuccessful',
      'Identification_done'
    ) THEN resolved_user_id END)
  ) AS free_quota_hit_rate
FROM base
GROUP BY event_date
ORDER BY event_date;
