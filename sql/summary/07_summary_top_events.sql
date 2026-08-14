CREATE TABLE IF NOT EXISTS `{PROJECT}.{DATASET}.summary_top_events` (
  event_date       DATE    NOT NULL,
  event_name_base  STRING  NOT NULL,
  platform         STRING,
  country          STRING,
  event_count      INT64   NOT NULL,
  unique_users     INT64   NOT NULL,
  refreshed_at     TIMESTAMP NOT NULL
)
PARTITION BY event_date
CLUSTER BY event_name_base, platform;
