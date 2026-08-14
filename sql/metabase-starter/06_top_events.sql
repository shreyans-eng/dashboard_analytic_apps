-- Metabase starter: Top Events (raw Firebase export)
-- Visualization: Row bar chart — dimension: event_name, metric: event_count
-- Collection: Coinzy Analytics > Feature Usage

SELECT
  event_name,
  COUNT(*) AS event_count,
  COUNT(DISTINCT user_pseudo_id) AS unique_users
FROM `banknote-app-4f3fd.analytics_488476338.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
                        AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
  AND _TABLE_SUFFIX NOT LIKE 'intraday_%'
GROUP BY event_name
ORDER BY event_count DESC
LIMIT 30;

-- Tip: Coinzy wrapper events end in _android or _ios.
-- After deploying v_events_normalized, group by event_name_base instead.
