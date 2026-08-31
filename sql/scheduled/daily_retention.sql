-- Scheduled Query: daily_retention (D1 / D7 cohort retention)
-- Schedule: Daily at 08:45 UTC
-- Estimated scan: ~3-10 GB (cohort + activity join on events_*)

CREATE TABLE IF NOT EXISTS `{PROJECT}.analytics_summary.daily_retention` (
  cohort_date         DATE      NOT NULL,
  platform            STRING,
  country             STRING,
  cohort_size         INT64     NOT NULL,
  retained_d1         INT64     NOT NULL,
  retained_d4         INT64,
  retained_d7         INT64     NOT NULL,
  retained_d4_d7      INT64,
  retention_d1_rate   FLOAT64   NOT NULL,
  retention_d4_rate   FLOAT64,
  retention_d7_rate   FLOAT64   NOT NULL,
  retention_d4_d7_rate FLOAT64,
  refreshed_at        TIMESTAMP NOT NULL
)
PARTITION BY cohort_date
CLUSTER BY platform, country;

ALTER TABLE `{PROJECT}.analytics_summary.daily_retention`
  ADD COLUMN IF NOT EXISTS retained_d4 INT64,
  ADD COLUMN IF NOT EXISTS retained_d4_d7 INT64,
  ADD COLUMN IF NOT EXISTS retention_d4_rate FLOAT64,
  ADD COLUMN IF NOT EXISTS retention_d4_d7_rate FLOAT64;

DELETE FROM `{PROJECT}.analytics_summary.daily_retention`
WHERE cohort_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY);

INSERT INTO `{PROJECT}.analytics_summary.daily_retention` (
  cohort_date,
  platform,
  country,
  cohort_size,
  retained_d1,
  retained_d4,
  retained_d7,
  retained_d4_d7,
  retention_d1_rate,
  retention_d4_rate,
  retention_d7_rate,
  retention_d4_d7_rate,
  refreshed_at
)
-- Cohort = first_open. Return = session_start / App_open / first_open (not push).
WITH raw_events AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    user_pseudo_id,
    user_id AS ga4_user_id,
    geo.country AS geo_country,
    device.operating_system AS device_os,
    event_name,
    event_params
  FROM `{PROJECT}.{DATASET}.events_*`
  WHERE _TABLE_SUFFIX NOT LIKE 'intraday_%'
    AND _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 97 DAY))
                          AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
    AND REGEXP_REPLACE(event_name, r'_(android|ios)$', '') IN ('session_start', 'App_open', 'first_open')
),
normalized AS (
  SELECT
    event_date,
    COALESCE(ga4_user_id, user_pseudo_id) AS resolved_user_id,
    COALESCE(
      (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'platform'),
      CASE
        WHEN REGEXP_CONTAINS(event_name, r'_android$') THEN 'android'
        WHEN REGEXP_CONTAINS(event_name, r'_ios$') THEN 'ios'
        ELSE LOWER(device_os)
      END
    ) AS platform,
    COALESCE(
      (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'country'),
      NULLIF(geo_country, ''),
      'Unknown'
    ) AS country,
    REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS event_name_base
  FROM raw_events
),
first_open AS (
  SELECT resolved_user_id, MIN(event_date) AS cohort_date
  FROM normalized
  WHERE event_name_base = 'first_open'
  GROUP BY resolved_user_id
),
cohorts AS (
  SELECT
    f.cohort_date,
    n.platform,
    n.country,
    f.resolved_user_id
  FROM first_open f
  JOIN normalized n
    ON f.resolved_user_id = n.resolved_user_id AND f.cohort_date = n.event_date
  WHERE f.cohort_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
    AND n.event_name_base = 'first_open'
),
activity AS (
  SELECT DISTINCT resolved_user_id, event_date FROM normalized
)
SELECT
  c.cohort_date,
  c.platform,
  c.country,
  COUNT(DISTINCT c.resolved_user_id) AS cohort_size,
  COUNT(DISTINCT IF(a.event_date = DATE_ADD(c.cohort_date, INTERVAL 1 DAY), c.resolved_user_id, NULL)) AS retained_d1,
  COUNT(DISTINCT IF(a.event_date = DATE_ADD(c.cohort_date, INTERVAL 4 DAY), c.resolved_user_id, NULL)) AS retained_d4,
  COUNT(DISTINCT IF(a.event_date = DATE_ADD(c.cohort_date, INTERVAL 7 DAY), c.resolved_user_id, NULL)) AS retained_d7,
  COUNT(DISTINCT IF(a.event_date BETWEEN DATE_ADD(c.cohort_date, INTERVAL 4 DAY)
                                    AND DATE_ADD(c.cohort_date, INTERVAL 7 DAY), c.resolved_user_id, NULL)) AS retained_d4_d7,
  SAFE_DIVIDE(
    COUNT(DISTINCT IF(a.event_date = DATE_ADD(c.cohort_date, INTERVAL 1 DAY), c.resolved_user_id, NULL)),
    COUNT(DISTINCT c.resolved_user_id)
  ) AS retention_d1_rate,
  SAFE_DIVIDE(
    COUNT(DISTINCT IF(a.event_date = DATE_ADD(c.cohort_date, INTERVAL 4 DAY), c.resolved_user_id, NULL)),
    COUNT(DISTINCT c.resolved_user_id)
  ) AS retention_d4_rate,
  SAFE_DIVIDE(
    COUNT(DISTINCT IF(a.event_date = DATE_ADD(c.cohort_date, INTERVAL 7 DAY), c.resolved_user_id, NULL)),
    COUNT(DISTINCT c.resolved_user_id)
  ) AS retention_d7_rate,
  SAFE_DIVIDE(
    COUNT(DISTINCT IF(a.event_date BETWEEN DATE_ADD(c.cohort_date, INTERVAL 4 DAY)
                                     AND DATE_ADD(c.cohort_date, INTERVAL 7 DAY), c.resolved_user_id, NULL)),
    COUNT(DISTINCT c.resolved_user_id)
  ) AS retention_d4_d7_rate,
  CURRENT_TIMESTAMP() AS refreshed_at
FROM cohorts c
LEFT JOIN activity a ON c.resolved_user_id = a.resolved_user_id
GROUP BY c.cohort_date, c.platform, c.country;
