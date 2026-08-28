-- Distinct countries for the filter dropdown (summary_countries in the events dataset).
SELECT
  country
FROM `{PROJECT}.{DATASET}.summary_countries`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  AND country IS NOT NULL
  AND TRIM(country) != ''
  AND country != 'Unknown'
  [[AND platform = {{platform}}]]
GROUP BY country
ORDER BY country;
