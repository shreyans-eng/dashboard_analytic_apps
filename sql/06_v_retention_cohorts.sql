-- =============================================================================
-- v_retention_cohorts
-- Cohort retention by install/registration date.
-- Periods: D1, D7, D14, D30 (day offset from cohort_date).
--
-- Return definition: user had any activity on offset day.
-- Depends on: v_new_users, v_daily_active_users
-- =============================================================================

CREATE OR REPLACE VIEW `{PROJECT}.{DATASET}.v_retention_cohorts` AS

WITH cohorts AS (
  SELECT
    resolved_user_id,
    cohort_date,
    cohort_type,
    first_platform AS platform,
    first_country  AS country,
    first_app_version AS app_version
  FROM `{PROJECT}.{DATASET}.v_new_users`
  WHERE cohort_date IS NOT NULL
),

activity AS (
  SELECT DISTINCT
    resolved_user_id,
    event_date AS activity_date
  FROM `{PROJECT}.{DATASET}.v_daily_active_users`
),

cohort_activity AS (
  SELECT
    c.resolved_user_id,
    c.cohort_date,
    c.cohort_type,
    c.platform,
    c.country,
    c.app_version,
    a.activity_date,
    DATE_DIFF(a.activity_date, c.cohort_date, DAY) AS day_offset
  FROM cohorts c
  LEFT JOIN activity a
    ON c.resolved_user_id = a.resolved_user_id
   AND a.activity_date >= c.cohort_date
   AND DATE_DIFF(a.activity_date, c.cohort_date, DAY) <= 30
),

cohort_sizes AS (
  SELECT
    cohort_date,
    cohort_type,
    platform,
    country,
    app_version,
    COUNT(DISTINCT resolved_user_id) AS cohort_size
  FROM cohorts
  GROUP BY cohort_date, cohort_type, platform, country, app_version
),

retention_flags AS (
  SELECT
    cohort_date,
    cohort_type,
    platform,
    country,
    app_version,
    resolved_user_id,
    MAX(CASE WHEN day_offset = 1  THEN 1 ELSE 0 END) AS returned_d1,
    MAX(CASE WHEN day_offset = 7  THEN 1 ELSE 0 END) AS returned_d7,
    MAX(CASE WHEN day_offset = 14 THEN 1 ELSE 0 END) AS returned_d14,
    MAX(CASE WHEN day_offset = 30 THEN 1 ELSE 0 END) AS returned_d30
  FROM cohort_activity
  GROUP BY cohort_date, cohort_type, platform, country, app_version, resolved_user_id
)

SELECT
  r.cohort_date,
  r.cohort_type,
  r.platform,
  r.country,
  r.app_version,
  cs.cohort_size,

  SUM(r.returned_d1)  AS retained_d1,
  SUM(r.returned_d7)  AS retained_d7,
  SUM(r.returned_d14) AS retained_d14,
  SUM(r.returned_d30) AS retained_d30,

  SAFE_DIVIDE(SUM(r.returned_d1),  cs.cohort_size) AS retention_d1_rate,
  SAFE_DIVIDE(SUM(r.returned_d7),  cs.cohort_size) AS retention_d7_rate,
  SAFE_DIVIDE(SUM(r.returned_d14), cs.cohort_size) AS retention_d14_rate,
  SAFE_DIVIDE(SUM(r.returned_d30), cs.cohort_size) AS retention_d30_rate

FROM retention_flags r
JOIN cohort_sizes cs
  ON r.cohort_date = cs.cohort_date
 AND r.cohort_type = cs.cohort_type
 AND r.platform = cs.platform
 AND r.country = cs.country
 AND r.app_version = cs.app_version
GROUP BY
  r.cohort_date,
  r.cohort_type,
  r.platform,
  r.country,
  r.app_version,
  cs.cohort_size;
