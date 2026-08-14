CREATE TABLE IF NOT EXISTS `{PROJECT}.{DATASET}.summary_platform` (
  event_date     DATE    NOT NULL,
  platform       STRING  NOT NULL,
  country        STRING,
  unique_users   INT64   NOT NULL,
  refreshed_at   TIMESTAMP NOT NULL
)
PARTITION BY event_date
CLUSTER BY platform, country;
