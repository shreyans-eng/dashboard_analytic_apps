-- Metabase starter: Daily Active Users (raw Firebase export)
-- Visualization: Line chart — X: event_date, Y: dau
-- Collection: Coinzy Analytics > Executive
-- Works without deploying analytics views

SELECT
  PARSE_DATE('%Y%m%d', event_date) AS event_date,
  COUNT(DISTINCT user_pseudo_id) AS dau
FROM `banknote-app-4f3fd.analytics_488476338.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
                        AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
  AND _TABLE_SUFFIX NOT LIKE 'intraday_%'
GROUP BY event_date
ORDER BY event_date;

-- After deploying v_daily_active_users, prefer:
-- SELECT event_date, COUNT(DISTINCT resolved_user_id) AS dau
-- FROM `banknote-app-4f3fd.analytics_488476338.v_daily_active_users`
-- WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
-- GROUP BY event_date ORDER BY event_date;
