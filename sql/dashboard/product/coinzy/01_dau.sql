-- =============================================================================
-- Coinzy MVP #1 — DAU from raw events_*
-- Qualifying: session_start, App_open, first_open (and _android / _ios variants)
-- Does not count notification_display. That is notification_dau on product_daily_signals.
-- =============================================================================

SELECT
  PARSE_DATE('%Y%m%d', event_date) AS event_date,
  COUNT(DISTINCT {{resolved_user_id}}) AS dau
FROM `{PROJECT}.{DATASET}.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', {{start_date}})
                        AND FORMAT_DATE('%Y%m%d', {{end_date}})
  AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
  AND {{dau_event_predicate}}
  [[AND event_country = {{country}}]]
  [[AND event_platform = {{platform}}]]
GROUP BY event_date
ORDER BY event_date;
