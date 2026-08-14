-- Metabase starter: Weekly Active Users (rolling 7-day, raw export)
-- Visualization: Line chart — X: week_end_date, Y: wau
-- Collection: Coinzy Analytics > Executive

WITH daily_users AS (
  SELECT DISTINCT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    user_pseudo_id
  FROM `banknote-app-4f3fd.analytics_488476338.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY))
                          AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
    AND _TABLE_SUFFIX NOT LIKE 'intraday_%'
),

date_spine AS (
  SELECT day AS anchor_date
  FROM UNNEST(GENERATE_DATE_ARRAY(
    DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY),
    CURRENT_DATE()
  )) AS day
)

SELECT
  d.anchor_date AS week_end_date,
  COUNT(DISTINCT du.user_pseudo_id) AS wau
FROM date_spine d
LEFT JOIN daily_users du
  ON du.event_date BETWEEN DATE_SUB(d.anchor_date, INTERVAL 6 DAY) AND d.anchor_date
GROUP BY d.anchor_date
ORDER BY d.anchor_date;
