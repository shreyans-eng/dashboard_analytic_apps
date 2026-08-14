-- Scheduled Query: daily_new_users (first-seen cohort date)
-- Schedule: Daily at 08:30 UTC
-- Estimated scan: ~2-8 GB (full history for first-seen; optimize with incremental MERGE in prod)

CREATE TABLE IF NOT EXISTS `{PROJECT}.analytics_summary.daily_new_users` (
  cohort_date   DATE      NOT NULL,
  platform      STRING,
  country       STRING,
  new_users     INT64     NOT NULL,
  refreshed_at  TIMESTAMP NOT NULL
)
PARTITION BY cohort_date
CLUSTER BY platform, country;

CREATE OR REPLACE TEMP TABLE _new_user_staging AS
WITH raw_events AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    user_pseudo_id,
    user_id AS ga4_user_id,
    geo.country AS geo_country,
    device.operating_system AS device_os,
    platform,
    event_name,
    event_params
  FROM `{PROJECT}.{DATASET}.events_*`
  WHERE _TABLE_SUFFIX NOT LIKE 'intraday_%'
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
    ) AS country
  FROM raw_events
),
first_seen AS (
  SELECT
    resolved_user_id,
    MIN(event_date) AS cohort_date,
    ARRAY_AGG(platform ORDER BY event_date LIMIT 1)[OFFSET(0)] AS platform,
    ARRAY_AGG(country ORDER BY event_date LIMIT 1)[OFFSET(0)] AS country
  FROM normalized
  GROUP BY resolved_user_id
)
SELECT
  cohort_date,
  platform,
  country,
  COUNT(DISTINCT resolved_user_id) AS new_users,
  CURRENT_TIMESTAMP() AS refreshed_at
FROM first_seen
WHERE cohort_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
GROUP BY cohort_date, platform, country;

DELETE FROM `{PROJECT}.analytics_summary.daily_new_users`
WHERE cohort_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY);

INSERT INTO `{PROJECT}.analytics_summary.daily_new_users`
SELECT * FROM _new_user_staging;
