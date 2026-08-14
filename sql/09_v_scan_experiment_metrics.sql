-- =============================================================================
-- v_scan_experiment_metrics
-- Free-scan limit experiment (scan_limit_variant v1–v4).
-- Metric #10: scans/user, D1/D7 retention, Pro conversion by variant.
-- Depends on: v_events_normalized, v_new_users, v_daily_active_users
-- =============================================================================

CREATE OR REPLACE VIEW `{PROJECT}.{DATASET}.v_scan_experiment_metrics` AS

WITH user_variant AS (
  -- Assign each user their most common non-null scan_limit_variant
  SELECT
    resolved_user_id,
    APPROX_TOP_COUNT(scan_limit_variant, 1)[OFFSET(0)].value AS scan_limit_variant,
    APPROX_TOP_COUNT(platform, 1)[OFFSET(0)].value AS platform,
    APPROX_TOP_COUNT(country, 1)[OFFSET(0)].value AS country,
    MIN(event_date) AS first_variant_date
  FROM `{PROJECT}.{DATASET}.v_events_normalized`
  WHERE resolved_user_id IS NOT NULL
    AND scan_limit_variant IS NOT NULL
    AND scan_limit_variant != ''
  GROUP BY resolved_user_id
),

user_activity AS (
  SELECT
    d.resolved_user_id,
    d.event_date,
    d.identifications_success,
    d.subscription_confirms,
    d.identifications
  FROM `{PROJECT}.{DATASET}.v_daily_active_users` d
),

cohort AS (
  SELECT
    n.resolved_user_id,
    n.cohort_date,
    v.scan_limit_variant,
    COALESCE(v.platform, n.first_platform) AS platform,
    COALESCE(v.country, n.first_country) AS country
  FROM `{PROJECT}.{DATASET}.v_new_users` n
  INNER JOIN user_variant v
    ON n.resolved_user_id = v.resolved_user_id
  WHERE n.cohort_date IS NOT NULL
),

-- Activity in first 7 / 30 days after cohort for scans & conversion
windowed AS (
  SELECT
    c.resolved_user_id,
    c.cohort_date,
    c.scan_limit_variant,
    c.platform,
    c.country,
    SUM(IF(a.event_date BETWEEN c.cohort_date AND DATE_ADD(c.cohort_date, INTERVAL 6 DAY),
           a.identifications_success, 0)) AS scans_d7,
    SUM(IF(a.event_date BETWEEN c.cohort_date AND DATE_ADD(c.cohort_date, INTERVAL 29 DAY),
           a.identifications_success, 0)) AS scans_d30,
    MAX(IF(a.event_date = DATE_ADD(c.cohort_date, INTERVAL 1 DAY), 1, 0)) AS retained_d1,
    MAX(IF(a.event_date = DATE_ADD(c.cohort_date, INTERVAL 7 DAY), 1, 0)) AS retained_d7,
    MAX(IF(a.subscription_confirms > 0
           AND a.event_date BETWEEN c.cohort_date AND DATE_ADD(c.cohort_date, INTERVAL 29 DAY),
           1, 0)) AS converted_pro_d30,
    MAX(IF(a.subscription_confirms > 0
           AND a.event_date BETWEEN c.cohort_date AND DATE_ADD(c.cohort_date, INTERVAL 6 DAY),
           1, 0)) AS converted_pro_d7
  FROM cohort c
  LEFT JOIN user_activity a
    ON c.resolved_user_id = a.resolved_user_id
   AND a.event_date >= c.cohort_date
   AND a.event_date <= DATE_ADD(c.cohort_date, INTERVAL 29 DAY)
  GROUP BY
    c.resolved_user_id, c.cohort_date, c.scan_limit_variant, c.platform, c.country
)

SELECT
  cohort_date,
  scan_limit_variant,
  platform,
  country,

  COUNT(DISTINCT resolved_user_id) AS cohort_size,

  -- Engagement
  AVG(scans_d7)  AS avg_scans_per_user_d7,
  AVG(scans_d30) AS avg_scans_per_user_d30,
  SUM(scans_d7)  AS total_scans_d7,

  -- Retention (mature cohorts only — filter in dashboard SQL)
  SUM(retained_d1) AS retained_d1,
  SUM(retained_d7) AS retained_d7,
  SAFE_DIVIDE(SUM(retained_d1), COUNT(DISTINCT resolved_user_id)) AS retention_d1_rate,
  SAFE_DIVIDE(SUM(retained_d7), COUNT(DISTINCT resolved_user_id)) AS retention_d7_rate,

  -- Monetization
  SUM(converted_pro_d7)  AS pro_converts_d7,
  SUM(converted_pro_d30) AS pro_converts_d30,
  SAFE_DIVIDE(SUM(converted_pro_d7), COUNT(DISTINCT resolved_user_id))  AS pro_conversion_d7_rate,
  SAFE_DIVIDE(SUM(converted_pro_d30), COUNT(DISTINCT resolved_user_id)) AS pro_conversion_d30_rate

FROM windowed
GROUP BY cohort_date, scan_limit_variant, platform, country;
