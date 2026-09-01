-- =============================================================================
-- Coinzy scan limits: free vs subscribed
-- Paid: subs_confirm / discount / paid_purchase / trial_purchase
-- Quota: Identified_limit_reached + free_scan_* (FreeScanLimitUtil.kt)
-- =============================================================================

WITH bounds AS (
  SELECT
    {{start_date}} AS start_d,
    {{end_date}} AS end_d,
    DATE_SUB({{start_date}}, INTERVAL 180 DAY) AS paid_from,
    FORMAT_DATE('%Y%m%d', DATE_SUB({{start_date}}, INTERVAL 180 DAY)) AS paid_from_s,
    FORMAT_DATE('%Y%m%d', {{start_date}}) AS start_s,
    FORMAT_DATE('%Y%m%d', {{end_date}}) AS end_s
),
base AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    COALESCE(NULLIF(TRIM(user_id), ''), user_pseudo_id) AS uid,
    REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS event_name_base
  FROM `{PROJECT}.{DATASET}.events_*`, bounds
  WHERE _TABLE_SUFFIX BETWEEN paid_from_s AND end_s
    AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
    AND COALESCE(NULLIF(TRIM(user_id), ''), user_pseudo_id) IS NOT NULL
    AND (
      REGEXP_REPLACE(event_name, r'_(android|ios)$', '') IN (
        'subs_confirm', 'subs_confirm_discount',
        'paid_purchase', 'trial_purchase', 'in_app_purchase', 'life_time_access'
      )
      OR (
        _TABLE_SUFFIX >= start_s
        AND REGEXP_REPLACE(event_name, r'_(android|ios)$', '') IN (
          'Identified_limit_reached', 'identified_limit_reached',
          'scan_quota_exhausted', 'Scan_quota_exhausted',
          'limit_exceeded', 'Limit_exceeded',
          'free_scan_limit_exceeded', 'free_scan_blocked',
          'free_scan_success_quota_exhausted', 'free_scan_fail_quota_exhausted',
          'Identification_unsuccessful_limit_reached',
          'identification_done_success', 'Identification_done_success',
          'identification_done_failure', 'Identification_done_failure',
          'Identification_failed', 'Identification_unsuccessful',
          'Identification_done'
        )
      )
    )
    [[AND event_country = {{country}}]]
    [[AND event_platform = {{platform}}]]
),
paid AS (
  SELECT
    uid,
    MIN(event_date) AS paid_on
  FROM base
  WHERE event_name_base IN (
    'subs_confirm', 'subs_confirm_discount',
    'paid_purchase', 'trial_purchase', 'in_app_purchase', 'life_time_access'
  )
  GROUP BY uid
),
daily AS (
  SELECT
    b.event_date,
    b.uid,
    MAX(IF(p.uid IS NOT NULL AND p.paid_on <= b.event_date, 1, 0)) AS is_subscribed,
    MAX(IF(b.event_name_base IN (
      'identification_done_success', 'Identification_done_success',
      'identification_done_failure', 'Identification_done_failure',
      'Identification_failed', 'Identification_unsuccessful',
      'Identification_done'
    ), 1, 0)) AS scanned,
    MAX(IF(b.event_name_base IN (
      'free_scan_success_quota_exhausted',
      'free_scan_limit_exceeded',
      'free_scan_blocked',
      'Identified_limit_reached', 'identified_limit_reached',
      'scan_quota_exhausted', 'Scan_quota_exhausted',
      'limit_exceeded', 'Limit_exceeded'
    ), 1, 0)) AS hit_success_limit,
    MAX(IF(b.event_name_base IN (
      'free_scan_fail_quota_exhausted',
      'Identification_unsuccessful_limit_reached'
    ), 1, 0)) AS hit_fail_limit
  FROM base b
  CROSS JOIN bounds
  LEFT JOIN paid p ON b.uid = p.uid
  WHERE b.event_date BETWEEN bounds.start_d AND bounds.end_d
  GROUP BY b.event_date, b.uid
)
SELECT
  event_date,
  COUNTIF(scanned = 1 AND is_subscribed = 0) AS free_scanners,
  COUNTIF(scanned = 1 AND is_subscribed = 1) AS subscribed_scanners,
  COUNTIF(hit_success_limit = 1 AND is_subscribed = 0) AS free_success_limit_users,
  COUNTIF(hit_fail_limit = 1 AND is_subscribed = 0) AS free_fail_limit_users,
  COUNTIF(hit_success_limit = 1 AND is_subscribed = 1) AS subscribed_success_limit_users,
  COUNTIF(hit_fail_limit = 1 AND is_subscribed = 1) AS subscribed_fail_limit_users,
  SAFE_DIVIDE(
    COUNTIF(hit_success_limit = 1 AND is_subscribed = 0),
    COUNTIF(scanned = 1 AND is_subscribed = 0)
  ) AS free_success_limit_rate,
  SAFE_DIVIDE(
    COUNTIF(hit_fail_limit = 1 AND is_subscribed = 0),
    COUNTIF(scanned = 1 AND is_subscribed = 0)
  ) AS free_fail_limit_rate,
  SAFE_DIVIDE(
    COUNTIF(hit_success_limit = 1 AND is_subscribed = 1),
    COUNTIF(scanned = 1 AND is_subscribed = 1)
  ) AS subscribed_success_limit_rate,
  SAFE_DIVIDE(
    COUNTIF(hit_fail_limit = 1 AND is_subscribed = 1),
    COUNTIF(scanned = 1 AND is_subscribed = 1)
  ) AS subscribed_fail_limit_rate
FROM daily
GROUP BY event_date
ORDER BY event_date;
