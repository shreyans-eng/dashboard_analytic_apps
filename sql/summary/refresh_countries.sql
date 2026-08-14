MERGE `{PROJECT}.{DATASET}.summary_countries` T
USING (
  SELECT
    event_date,
    country,
    platform,
    SUM(dau) AS total_dau,
    SUM(new_users) AS total_new_users,
    CURRENT_TIMESTAMP() AS refreshed_at
  FROM `{PROJECT}.{DATASET}.v_country_metrics`
  WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
    AND country IS NOT NULL AND country != 'Unknown'
  GROUP BY event_date, country, platform
) S
ON T.event_date = S.event_date AND T.country = S.country AND IFNULL(T.platform, '') = IFNULL(S.platform, '')
WHEN MATCHED THEN UPDATE SET total_dau = S.total_dau, total_new_users = S.total_new_users, refreshed_at = S.refreshed_at
WHEN NOT MATCHED THEN INSERT ROW;
