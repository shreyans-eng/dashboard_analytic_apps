MERGE `{PROJECT}.{DATASET}.summary_top_events` T
USING (
  SELECT
    event_date,
    event_name_base,
    platform,
    country,
    COUNT(*) AS event_count,
    COUNT(DISTINCT resolved_user_id) AS unique_users,
    CURRENT_TIMESTAMP() AS refreshed_at
  FROM `{PROJECT}.{DATASET}.v_events_normalized`
  WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    AND event_name_base NOT IN ('user_engagement', 'session_start', 'firebase_campaign')
  GROUP BY event_date, event_name_base, platform, country
) S
ON T.event_date = S.event_date
 AND T.event_name_base = S.event_name_base
 AND IFNULL(T.platform, '') = IFNULL(S.platform, '')
 AND IFNULL(T.country, '') = IFNULL(S.country, '')
WHEN MATCHED THEN UPDATE SET event_count = S.event_count, unique_users = S.unique_users, refreshed_at = S.refreshed_at
WHEN NOT MATCHED THEN INSERT ROW;
