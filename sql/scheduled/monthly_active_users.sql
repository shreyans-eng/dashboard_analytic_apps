-- Scheduled Query: monthly_active_users
-- Schedule: Daily at 08:15 UTC (after daily_active_users)
-- Estimated scan: ~1-5 GB (same events window, _TABLE_SUFFIX filtered)

CREATE TABLE IF NOT EXISTS `{PROJECT}.analytics_summary.monthly_active_users` (
  activity_month DATE      NOT NULL,
  platform       STRING,
  country        STRING,
  mau            INT64     NOT NULL,
  refreshed_at   TIMESTAMP NOT NULL
)
PARTITION BY activity_month
CLUSTER BY platform, country;

DELETE FROM `{PROJECT}.analytics_summary.monthly_active_users`
WHERE activity_month >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH), MONTH);

INSERT INTO `{PROJECT}.analytics_summary.monthly_active_users`
  (activity_month, platform, country, mau, refreshed_at)
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
    AND _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 365 DAY))
                          AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
),
normalized AS (
  SELECT
    DATE_TRUNC(event_date, MONTH) AS activity_month,
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
  activity_month,
  platform,
  country,
  COUNT(DISTINCT resolved_user_id) AS mau,
  CURRENT_TIMESTAMP() AS refreshed_at
FROM normalized
GROUP BY activity_month, platform, country;
