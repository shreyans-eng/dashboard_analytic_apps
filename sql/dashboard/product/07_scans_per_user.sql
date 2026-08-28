-- =============================================================================
-- MVP #7 — Scans per active user
-- Mean among everyone who used the app that day, plus P10–P99 among people
-- who got at least one successful ID (so a few heavy scanners do not hide
-- what a typical scanner actually does).
-- Grain: user-day from v_daily_active_users (identifications_success).
-- =============================================================================

WITH user_day AS (
  SELECT
    event_date,
    resolved_user_id,
    SUM(identifications_success) AS scans
  FROM `{PROJECT}.{DATASET}.v_daily_active_users`
  WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
    [[AND country = {{country}}]]
    [[AND platform = {{platform}}]]
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
