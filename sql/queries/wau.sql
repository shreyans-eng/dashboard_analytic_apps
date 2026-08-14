-- =============================================================================
-- WAU — Weekly Active Users (rolling 7-day distinct users)
-- Metabase: Number card or line chart
-- =============================================================================

WITH date_spine AS (
  SELECT day AS event_date
  FROM UNNEST(GENERATE_DATE_ARRAY({{start_date}}, {{end_date}})) AS day
),

daily_users AS (
  SELECT
    event_date,
    resolved_user_id,
    country,
    platform,
    app_version
  FROM `{PROJECT}.{DATASET}.v_daily_active_users`
  WHERE event_date BETWEEN DATE_SUB({{start_date}}, INTERVAL 6 DAY) AND {{end_date}}
    [[AND country = {{country}}]]
    [[AND platform = {{platform}}]]
    [[AND app_version = {{app_version}}]]
)

SELECT
  d.event_date,
  COUNT(DISTINCT du.resolved_user_id) AS wau
FROM date_spine d
LEFT JOIN daily_users du
  ON du.event_date BETWEEN DATE_SUB(d.event_date, INTERVAL 6 DAY) AND d.event_date
GROUP BY d.event_date
ORDER BY d.event_date;
