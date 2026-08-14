-- Scheduled Query: top_events
-- Schedule: Daily at 09:10 UTC
-- Estimated scan: ~1-3 GB (30-day events window, selected columns only)

CREATE TABLE IF NOT EXISTS `{PROJECT}.analytics_summary.top_events` (
  event_date       DATE      NOT NULL,
  event_name_base  STRING    NOT NULL,
  platform         STRING,
  country          STRING,
  event_count      INT64     NOT NULL,
  unique_users     INT64     NOT NULL,
  refreshed_at     TIMESTAMP NOT NULL
)
PARTITION BY event_date
CLUSTER BY event_name_base, platform;

DELETE FROM `{PROJECT}.analytics_summary.top_events`
WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY);

INSERT INTO `{PROJECT}.analytics_summary.top_events`
WITH raw_events AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    event_name,
    user_pseudo_id,
    user_id AS ga4_user_id,
    geo.country AS geo_country,
    device.operating_system AS device_os,
    event_params
  FROM `{PROJECT}.{DATASET}.events_*`
  WHERE _TABLE_SUFFIX NOT LIKE 'intraday_%'
    AND _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
                          AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
),
normalized AS (
  SELECT
    event_date,
    CASE
      WHEN REGEXP_CONTAINS(event_name, r'_android$') THEN REGEXP_REPLACE(event_name, r'_android$', '')
      WHEN REGEXP_CONTAINS(event_name, r'_ios$') THEN REGEXP_REPLACE(event_name, r'_ios$', '')
      ELSE event_name
    END AS event_name_base,
    COALESCE(ga4_user_id, user_pseudo_id) AS resolved_user_id,
    COALESCE(
      (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'platform'),
      LOWER(device_os)
    ) AS platform,
    COALESCE(
      (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'country'),
      NULLIF(geo_country, ''),
      'Unknown'
    ) AS country
  FROM raw_events
  WHERE event_name NOT IN ('user_engagement', 'session_start', 'firebase_campaign')
)
SELECT
  event_date,
  event_name_base,
  platform,
  country,
  COUNT(*) AS event_count,
  COUNT(DISTINCT resolved_user_id) AS unique_users,
  CURRENT_TIMESTAMP() AS refreshed_at
FROM normalized
GROUP BY event_date, event_name_base, platform, country;
