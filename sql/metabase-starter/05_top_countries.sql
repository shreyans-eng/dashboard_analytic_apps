-- Metabase starter: Top Countries (raw Firebase export)
-- Visualization: Row bar chart — dimension: country, metric: unique_users
-- Collection: Coinzy Analytics > Acquisition

SELECT
  COALESCE(geo.country, 'Unknown') AS country,
  COUNT(DISTINCT user_pseudo_id) AS unique_users,
  COUNT(*) AS total_events
FROM `banknote-app-4f3fd.analytics_488476338.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
                        AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
  AND _TABLE_SUFFIX NOT LIKE 'intraday_%'
GROUP BY country
ORDER BY unique_users DESC
LIMIT 20;
