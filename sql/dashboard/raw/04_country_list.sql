-- Distinct countries for the filter dropdown.
-- geo.country only (no event_params UNNEST) so this stays cheap as a last resort.
SELECT
  geo.country AS country
FROM `{PROJECT}.{DATASET}.events_*`
WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', {{start_date}})
                        AND FORMAT_DATE('%Y%m%d', {{end_date}})
  AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
  AND geo.country IS NOT NULL
  AND geo.country != ''
  [[AND event_platform = {{platform}}]]
GROUP BY country
ORDER BY country;
