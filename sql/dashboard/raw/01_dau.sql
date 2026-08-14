-- =============================================================================
-- Raw-events DAU (no views required — works with Data Viewer only)
-- =============================================================================

SELECT
  PARSE_DATE('%Y%m%d', event_date) AS event_date,
  COUNT(DISTINCT COALESCE(
    user_id,
    (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'user_id'),
    user_pseudo_id
  )) AS dau
FROM `{PROJECT}.{DATASET}.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', {{start_date}})
                        AND FORMAT_DATE('%Y%m%d', {{end_date}})
  AND _TABLE_SUFFIX NOT LIKE 'intraday_%'
  [[AND event_country = {{country}}]]
  [[AND event_platform = {{platform}}]]
GROUP BY event_date
ORDER BY event_date;
