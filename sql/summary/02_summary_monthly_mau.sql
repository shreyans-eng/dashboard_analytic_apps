CREATE TABLE IF NOT EXISTS `{PROJECT}.{DATASET}.summary_monthly_mau` (
  activity_month DATE    NOT NULL,
  platform       STRING,
  country        STRING,
  mau            INT64   NOT NULL,
  refreshed_at   TIMESTAMP NOT NULL
)
PARTITION BY activity_month
CLUSTER BY platform, country;
