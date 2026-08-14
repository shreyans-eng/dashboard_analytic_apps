MERGE `{PROJECT}.{DATASET}.summary_platform` T
USING (
  SELECT
    event_date,
    platform,
    country,
    COUNT(DISTINCT resolved_user_id) AS unique_users,
    CURRENT_TIMESTAMP() AS refreshed_at
  FROM `{PROJECT}.{DATASET}.v_daily_active_users`
  WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
    AND platform IS NOT NULL
  GROUP BY event_date, platform, country
) S
ON T.event_date = S.event_date AND T.platform = S.platform AND IFNULL(T.country, '') = IFNULL(S.country, '')
WHEN MATCHED THEN UPDATE SET unique_users = S.unique_users, refreshed_at = S.refreshed_at
WHEN NOT MATCHED THEN INSERT ROW;
