-- =============================================================================
-- Raw-events MAU (no views required — works with Data Viewer only)
-- =============================================================================

SELECT
  DATE_TRUNC(PARSE_DATE('%Y%m%d', event_date), MONTH) AS activity_month,
  COUNT(DISTINCT COALESCE(
    user_id,
    (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'user_id'),
    user_pseudo_id
  )) AS mau
FROM `{PROJECT}.{DATASET}.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_TRUNC({{start_date}}, MONTH))
                        AND FORMAT_DATE('%Y%m%d', {{end_date}})
  AND _TABLE_SUFFIX NOT LIKE 'intraday_%'
  [[AND event_country = {{country}}]]
  [[AND event_platform = {{platform}}]]
GROUP BY activity_month
ORDER BY activity_month;
