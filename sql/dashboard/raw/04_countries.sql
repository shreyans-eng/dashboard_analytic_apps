-- =============================================================================
-- Raw-events top countries
-- =============================================================================

SELECT
  COALESCE(
    NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'country'), ''),
    NULLIF(geo.country, ''),
    'Unknown'
  ) AS country,
  COUNT(DISTINCT COALESCE(
    user_id,
    (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'user_id'),
    user_pseudo_id
  )) AS total_new_users
FROM `{PROJECT}.{DATASET}.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', {{start_date}})
                        AND FORMAT_DATE('%Y%m%d', {{end_date}})
  AND _TABLE_SUFFIX NOT LIKE 'intraday_%'
  [[AND event_platform = {{platform}}]]
GROUP BY country
HAVING country != 'Unknown'
ORDER BY total_new_users DESC
LIMIT 40;
