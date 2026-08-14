CREATE TABLE IF NOT EXISTS `{PROJECT}.{DATASET}.summary_countries` (
  event_date      DATE    NOT NULL,
  country         STRING  NOT NULL,
  platform        STRING,
  total_dau       INT64   NOT NULL,
  total_new_users INT64   NOT NULL,
  refreshed_at    TIMESTAMP NOT NULL
)
PARTITION BY event_date
CLUSTER BY country, platform;
