-- Metabase starter: Event Counts (raw Firebase export)
-- Visualization: Table or bar chart by event_name
-- Collection: Coinzy Analytics > Debug Queries
-- Works without deploying analytics views

SELECT
  PARSE_DATE('%Y%m%d', event_date) AS event_date,
  event_name,
  COUNT(*) AS event_count,
  COUNT(DISTINCT user_pseudo_id) AS unique_users
FROM `banknote-app-4f3fd.analytics_488476338.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
                        AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
  AND _TABLE_SUFFIX NOT LIKE 'intraday_%'
GROUP BY event_date, event_name
ORDER BY event_date DESC, event_count DESC;
