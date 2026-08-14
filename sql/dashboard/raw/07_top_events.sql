-- =============================================================================
-- Raw-events top events
-- =============================================================================

SELECT
  REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS event_name_base,
  COUNT(*) AS event_count
FROM `{PROJECT}.{DATASET}.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', {{start_date}})
                        AND FORMAT_DATE('%Y%m%d', {{end_date}})
  AND _TABLE_SUFFIX NOT LIKE 'intraday_%'
  [[AND event_country = {{country}}]]
  [[AND event_platform = {{platform}}]]
GROUP BY event_name_base
ORDER BY event_count DESC
LIMIT 25;
