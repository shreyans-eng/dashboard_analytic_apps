-- MERGE summary_daily_dau from v_daily_active_users (last N days)
MERGE `{PROJECT}.{DATASET}.summary_daily_dau` T
USING (
  SELECT
    event_date,
    platform,
    country,
    COUNT(DISTINCT resolved_user_id) AS dau,
    CURRENT_TIMESTAMP() AS refreshed_at
  FROM `{PROJECT}.{DATASET}.v_daily_active_users`
  WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
  GROUP BY event_date, platform, country
) S
ON T.event_date = S.event_date
 AND IFNULL(T.platform, '') = IFNULL(S.platform, '')
 AND IFNULL(T.country, '') = IFNULL(S.country, '')
WHEN MATCHED THEN UPDATE SET dau = S.dau, refreshed_at = S.refreshed_at
WHEN NOT MATCHED THEN INSERT (event_date, platform, country, dau, refreshed_at)
VALUES (S.event_date, S.platform, S.country, S.dau, S.refreshed_at);
