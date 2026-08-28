-- Distinct countries for the filter dropdown (not the Top Countries chart).
-- No LIMIT — the chart query stays at top 40.
SELECT
  country
FROM `{PROJECT}.{SUMMARY_DATASET}.country_metrics`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  AND country IS NOT NULL
  AND TRIM(country) != ''
  AND country != 'Unknown'
  [[AND platform = {{platform}}]]
GROUP BY country
ORDER BY country;
