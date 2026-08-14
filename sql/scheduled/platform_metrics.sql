-- Scheduled Query: platform_metrics
-- Schedule: Daily at 09:05 UTC — derived from daily_active_users (~KB)

CREATE TABLE IF NOT EXISTS `{PROJECT}.analytics_summary.platform_metrics` (
  event_date     DATE      NOT NULL,
  platform       STRING    NOT NULL,
  country        STRING,
  unique_users   INT64     NOT NULL,
  refreshed_at   TIMESTAMP NOT NULL
)
PARTITION BY event_date
CLUSTER BY platform, country;

DELETE FROM `{PROJECT}.analytics_summary.platform_metrics`
WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY);

INSERT INTO `{PROJECT}.analytics_summary.platform_metrics`
  (event_date, platform, country, unique_users, refreshed_at)
SELECT
  event_date,
  platform,
  country,
  SUM(dau) AS unique_users,
  CURRENT_TIMESTAMP() AS refreshed_at
FROM `{PROJECT}.analytics_summary.daily_active_users`
WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
  AND platform IS NOT NULL
GROUP BY event_date, platform, country;
