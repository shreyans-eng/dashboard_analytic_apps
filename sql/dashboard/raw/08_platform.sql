-- =============================================================================
-- Raw-events platform split
-- =============================================================================

SELECT
  LOWER(COALESCE(device.operating_system, platform, 'unknown')) AS platform,
  COUNT(DISTINCT COALESCE(
    user_id,
    (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'user_id'),
    user_pseudo_id
  )) AS unique_users
FROM `{PROJECT}.{DATASET}.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', {{start_date}})
                        AND FORMAT_DATE('%Y%m%d', {{end_date}})
  AND _TABLE_SUFFIX NOT LIKE 'intraday_%'
  [[AND event_country = {{country}}]]
GROUP BY platform
ORDER BY unique_users DESC;
