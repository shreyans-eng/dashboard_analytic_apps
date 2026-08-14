-- =============================================================================
-- Scheduled Query: daily_active_users
-- Dataset: analytics_summary
-- Schedule: Daily at 08:00 UTC (after Firebase export lands)
-- Estimated scan: ~1-5 GB (90-day window on events_* with _TABLE_SUFFIX filter)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `{PROJECT}.analytics_summary.daily_active_users` (
  event_date    DATE      NOT NULL,
  platform      STRING,
  country       STRING,
  dau           INT64     NOT NULL,
  refreshed_at  TIMESTAMP NOT NULL
)
PARTITION BY event_date
CLUSTER BY platform, country;

DELETE FROM `{PROJECT}.analytics_summary.daily_active_users`
WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY);

INSERT INTO `{PROJECT}.analytics_summary.daily_active_users`
  (event_date, platform, country, dau, refreshed_at)
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
    AND _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY))
                          AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
  -- Intraday: uncomment block below if events_intraday_* exists
  -- UNION ALL
  -- SELECT ... FROM `{PROJECT}.{DATASET}.events_intraday_*` WHERE ...
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
)
SELECT
  event_date,
  platform,
  country,
  COUNT(DISTINCT resolved_user_id) AS dau,
  CURRENT_TIMESTAMP() AS refreshed_at
FROM normalized
GROUP BY event_date, platform, country;
