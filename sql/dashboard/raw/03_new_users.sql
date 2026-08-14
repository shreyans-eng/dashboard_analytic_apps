-- =============================================================================
-- Raw-events new users (first_open)
-- =============================================================================

SELECT
  PARSE_DATE('%Y%m%d', event_date) AS cohort_date,
  COUNT(DISTINCT COALESCE(
    user_id,
    (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'user_id'),
    user_pseudo_id
  )) AS new_users
FROM `{PROJECT}.{DATASET}.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', {{start_date}})
                        AND FORMAT_DATE('%Y%m%d', {{end_date}})
  AND _TABLE_SUFFIX NOT LIKE 'intraday_%'
  AND (
    event_name IN ('first_open', 'first_open_android', 'first_open_ios')
    OR REGEXP_CONTAINS(event_name, r'^first_open')
  )
  [[AND event_country = {{country}}]]
  [[AND event_platform = {{platform}}]]
GROUP BY cohort_date
ORDER BY cohort_date;
