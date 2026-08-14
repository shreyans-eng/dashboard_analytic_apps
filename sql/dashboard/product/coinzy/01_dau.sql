-- =============================================================================
-- Coinzy MVP #1 — DAU from raw events_* (no views required)
-- Events: any event that day. Identity: user_id / param user_id / user_pseudo_id
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
  AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
  [[AND event_country = {{country}}]]
  [[AND event_platform = {{platform}}]]
GROUP BY event_date
ORDER BY event_date;
