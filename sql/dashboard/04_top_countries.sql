-- =============================================================================
-- Coinzy Executive Dashboard — Top Countries
-- Source view: v_country_metrics
-- Visualization: Row bar chart (country → dau or new_users)
-- =============================================================================

SELECT
  country,
  SUM(dau)        AS total_dau,
  SUM(new_users)  AS total_new_users,
  SUM(total_events) AS total_events
FROM `{PROJECT}.{DATASET}.v_country_metrics`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
  AND country IS NOT NULL
  AND country != 'Unknown'
GROUP BY country
ORDER BY total_dau DESC
LIMIT 40;
