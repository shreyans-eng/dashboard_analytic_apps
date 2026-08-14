-- Scheduled Query: country_metrics
-- Schedule: Daily at 09:00 UTC
-- Estimated scan: reads daily_active_users + daily_new_users (~KB)

CREATE TABLE IF NOT EXISTS `{PROJECT}.analytics_summary.country_metrics` (
  event_date      DATE      NOT NULL,
  country         STRING    NOT NULL,
  platform        STRING,
  total_dau       INT64     NOT NULL,
  total_new_users INT64     NOT NULL,
  refreshed_at    TIMESTAMP NOT NULL
)
PARTITION BY event_date
CLUSTER BY country, platform;

DELETE FROM `{PROJECT}.analytics_summary.country_metrics`
WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY);

INSERT INTO `{PROJECT}.analytics_summary.country_metrics`
  (event_date, country, platform, total_dau, total_new_users, refreshed_at)
SELECT
  d.event_date,
  d.country,
  d.platform,
  SUM(d.dau) AS total_dau,
  IFNULL(SUM(n.new_users), 0) AS total_new_users,
  CURRENT_TIMESTAMP() AS refreshed_at
FROM `{PROJECT}.analytics_summary.daily_active_users` d
LEFT JOIN `{PROJECT}.analytics_summary.daily_new_users` n
  ON d.event_date = n.cohort_date
 AND IFNULL(d.platform, '') = IFNULL(n.platform, '')
 AND IFNULL(d.country, '') = IFNULL(n.country, '')
WHERE d.event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
  AND d.country IS NOT NULL AND d.country != 'Unknown'
GROUP BY d.event_date, d.country, d.platform;
