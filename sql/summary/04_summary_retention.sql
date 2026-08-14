CREATE TABLE IF NOT EXISTS `{PROJECT}.{DATASET}.summary_retention` (
  cohort_date         DATE    NOT NULL,
  platform            STRING,
  country             STRING,
  cohort_size         INT64   NOT NULL,
  retained_d1         INT64   NOT NULL,
  retained_d7         INT64   NOT NULL,
  retention_d1_rate   FLOAT64 NOT NULL,
  retention_d7_rate   FLOAT64 NOT NULL,
  refreshed_at        TIMESTAMP NOT NULL
)
PARTITION BY cohort_date
CLUSTER BY platform, country;
