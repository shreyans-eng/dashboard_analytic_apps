-- Metabase starter: Monthly Active Users (raw Firebase export)
-- Visualization: Bar chart — X: activity_month, Y: mau
-- Collection: Coinzy Analytics > Executive

SELECT
  DATE_TRUNC(PARSE_DATE('%Y%m%d', event_date), MONTH) AS activity_month,
  COUNT(DISTINCT user_pseudo_id) AS mau
FROM `banknote-app-4f3fd.analytics_488476338.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 365 DAY))
                        AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
  AND _TABLE_SUFFIX NOT LIKE 'intraday_%'
GROUP BY activity_month
ORDER BY activity_month;
