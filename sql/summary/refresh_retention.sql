MERGE `{PROJECT}.{DATASET}.summary_retention` T
USING (
  SELECT
    cohort_date,
    platform,
    country,
    cohort_size,
    retained_d1,
    retained_d7,
    retention_d1_rate,
    retention_d7_rate,
    CURRENT_TIMESTAMP() AS refreshed_at
  FROM `{PROJECT}.{DATASET}.v_retention_cohorts`
  WHERE cohort_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
) S
ON T.cohort_date = S.cohort_date
 AND IFNULL(T.platform, '') = IFNULL(S.platform, '')
 AND IFNULL(T.country, '') = IFNULL(S.country, '')
WHEN MATCHED THEN UPDATE SET
  cohort_size = S.cohort_size,
  retained_d1 = S.retained_d1,
  retained_d7 = S.retained_d7,
  retention_d1_rate = S.retention_d1_rate,
  retention_d7_rate = S.retention_d7_rate,
  refreshed_at = S.refreshed_at
WHEN NOT MATCHED THEN INSERT ROW;
