CREATE TABLE IF NOT EXISTS `{PROJECT}.{DATASET}.summary_new_users` (
  cohort_date   DATE    NOT NULL,
  platform      STRING,
  country       STRING,
  new_users     INT64   NOT NULL,
  refreshed_at  TIMESTAMP NOT NULL
)
PARTITION BY cohort_date
CLUSTER BY platform, country;
