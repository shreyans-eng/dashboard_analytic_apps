-- =============================================================================
-- Coinzy — Free-scan success quota (experiment)
--
-- HIT = success_remaining went from >0 → 0.
-- Exact event: free_scan_success_quota_exhausted
-- Unique users + hits of that event.
--
-- NOT a hit:
--   free_scan_success_consumed          — every successful scan
--   free_scan_fail_quota_exhausted      — informational; fail quota does not block
--   Identified_limit_reached            — do not use for this metric
--   Collection_limit_Reached            — collection cap, not this experiment
--
-- After success quota is exhausted:
--   free_scan_blocked                   — tried to scan again
--   free_scan_limit_exceeded            — exhausted-limit popup shown
--   free_scan_go_premium_tapped         — popup: go premium
--   free_scan_not_now_tapped            — popup: not now
--
-- free_scan_quota_reset                 — daily 24-hour quota reset
--
-- grain = 'day'   → unique people that calendar day
-- grain = 'range' → unique people in the whole selected range (event_date is NULL)
-- Banknote events are not mapped yet.
-- =============================================================================

WITH bounds AS (
  SELECT
    FORMAT_DATE('%Y%m%d', {{start_date}}) AS start_s,
    FORMAT_DATE('%Y%m%d', {{end_date}}) AS end_s
),
base AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    COALESCE(NULLIF(TRIM(user_id), ''), user_pseudo_id) AS uid,
    REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS ev
  FROM `{PROJECT}.{DATASET}.events_*`, bounds
  WHERE _TABLE_SUFFIX BETWEEN start_s AND end_s
    AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
    AND REGEXP_REPLACE(event_name, r'_(android|ios)$', '') IN (
      'free_scan_success_quota_exhausted',
      'free_scan_success_consumed',
      'free_scan_blocked',
      'free_scan_limit_exceeded',
      'free_scan_go_premium_tapped',
      'free_scan_not_now_tapped',
      'free_scan_fail_quota_exhausted',
      'free_scan_quota_reset'
    )
    [[AND event_country = {{country}}]]
    [[AND event_platform = {{platform}}]]
),
metrics AS (
  SELECT
    event_date,
    COUNT(DISTINCT IF(ev = 'free_scan_success_quota_exhausted', uid, NULL)) AS hit_users,
    COUNTIF(ev = 'free_scan_success_quota_exhausted') AS hit_hits,
    COUNT(DISTINCT IF(ev = 'free_scan_success_consumed', uid, NULL)) AS consumed_users,
    COUNTIF(ev = 'free_scan_success_consumed') AS consumed_hits,
    COUNT(DISTINCT IF(ev = 'free_scan_blocked', uid, NULL)) AS blocked_users,
    COUNTIF(ev = 'free_scan_blocked') AS blocked_hits,
    COUNT(DISTINCT IF(ev = 'free_scan_limit_exceeded', uid, NULL)) AS popup_users,
    COUNTIF(ev = 'free_scan_limit_exceeded') AS popup_hits,
    COUNT(DISTINCT IF(ev = 'free_scan_go_premium_tapped', uid, NULL)) AS go_premium_users,
    COUNTIF(ev = 'free_scan_go_premium_tapped') AS go_premium_hits,
    COUNT(DISTINCT IF(ev = 'free_scan_not_now_tapped', uid, NULL)) AS not_now_users,
    COUNTIF(ev = 'free_scan_not_now_tapped') AS not_now_hits,
    COUNT(DISTINCT IF(ev = 'free_scan_fail_quota_exhausted', uid, NULL)) AS fail_exhausted_users,
    COUNTIF(ev = 'free_scan_fail_quota_exhausted') AS fail_exhausted_hits,
    COUNT(DISTINCT IF(ev = 'free_scan_quota_reset', uid, NULL)) AS reset_users,
    COUNTIF(ev = 'free_scan_quota_reset') AS reset_hits
  FROM base
  WHERE uid IS NOT NULL
  GROUP BY GROUPING SETS ((event_date), ())
)
SELECT
  IF(event_date IS NULL, 'range', 'day') AS grain,
  event_date,
  hit_users,
  hit_hits,
  consumed_users,
  consumed_hits,
  blocked_users,
  blocked_hits,
  popup_users,
  popup_hits,
  go_premium_users,
  go_premium_hits,
  not_now_users,
  not_now_hits,
  fail_exhausted_users,
  fail_exhausted_hits,
  reset_users,
  reset_hits
FROM metrics
ORDER BY grain DESC, event_date;
