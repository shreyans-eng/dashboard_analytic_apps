-- Optional inventory table (complete event discovery — NOT a KPI table)
CREATE TABLE IF NOT EXISTS `{PROJECT}.{SUMMARY_DATASET}.event_inventory_daily` (
  event_date     DATE    NOT NULL,
  event_name     STRING  NOT NULL,
  event_count    INT64   NOT NULL,
  unique_users   INT64   NOT NULL,
  refreshed_at   TIMESTAMP NOT NULL
)
PARTITION BY event_date
CLUSTER BY event_name;

DELETE FROM `{PROJECT}.{SUMMARY_DATASET}.event_inventory_daily`
WHERE event_date BETWEEN PARSE_DATE('%Y%m%d', '{START_SUFFIX}')
                     AND PARSE_DATE('%Y%m%d', '{END_SUFFIX}');

INSERT INTO `{PROJECT}.{SUMMARY_DATASET}.event_inventory_daily`
SELECT
  PARSE_DATE('%Y%m%d', event_date) AS event_date,
  event_name,
  COUNT(*) AS event_count,
  COUNT(DISTINCT COALESCE(user_id, user_pseudo_id)) AS unique_users,
  CURRENT_TIMESTAMP() AS refreshed_at
FROM `{PROJECT}.{DATASET}.events_*`
WHERE _TABLE_SUFFIX BETWEEN '{START_SUFFIX}' AND '{END_SUFFIX}'
  AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
GROUP BY event_date, event_name;
