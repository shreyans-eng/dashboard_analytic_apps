MERGE `{PROJECT}.{DATASET}.summary_new_users` T
USING (
  SELECT
    cohort_date,
    first_platform AS platform,
    first_country AS country,
    COUNT(DISTINCT resolved_user_id) AS new_users,
    CURRENT_TIMESTAMP() AS refreshed_at
  FROM `{PROJECT}.{DATASET}.v_new_users`
  WHERE cohort_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
  GROUP BY cohort_date, first_platform, first_country
) S
ON T.cohort_date = S.cohort_date
 AND IFNULL(T.platform, '') = IFNULL(S.platform, '')
 AND IFNULL(T.country, '') = IFNULL(S.country, '')
WHEN MATCHED THEN UPDATE SET new_users = S.new_users, refreshed_at = S.refreshed_at
WHEN NOT MATCHED THEN INSERT (cohort_date, platform, country, new_users, refreshed_at)
VALUES (S.cohort_date, S.platform, S.country, S.new_users, S.refreshed_at);
