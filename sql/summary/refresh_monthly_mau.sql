MERGE `{PROJECT}.{DATASET}.summary_monthly_mau` T
USING (
  SELECT
    activity_month,
    platform,
    country,
    COUNT(DISTINCT resolved_user_id) AS mau,
    CURRENT_TIMESTAMP() AS refreshed_at
  FROM `{PROJECT}.{DATASET}.v_monthly_active_users`
  WHERE activity_month >= DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH), MONTH)
  GROUP BY activity_month, platform, country
) S
ON T.activity_month = S.activity_month
 AND IFNULL(T.platform, '') = IFNULL(S.platform, '')
 AND IFNULL(T.country, '') = IFNULL(S.country, '')
WHEN MATCHED THEN UPDATE SET mau = S.mau, refreshed_at = S.refreshed_at
WHEN NOT MATCHED THEN INSERT (activity_month, platform, country, mau, refreshed_at)
VALUES (S.activity_month, S.platform, S.country, S.mau, S.refreshed_at);
