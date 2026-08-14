-- =============================================================================
-- Validation: Country field exists and is populated
-- Expected: unknown_pct < 50% (adjust threshold as needed)
-- =============================================================================

SELECT
  'v_daily_active_users' AS view_name,
  COUNT(*) AS total_rows,
  COUNTIF(country IS NULL OR country = '' OR country = 'Unknown') AS unknown_country_rows,
  ROUND(100.0 * COUNTIF(country IS NULL OR country = '' OR country = 'Unknown') / COUNT(*), 2) AS unknown_pct,
  COUNT(DISTINCT country) AS distinct_countries
FROM `banknote-app-4f3fd.analytics_488476338.v_daily_active_users`

UNION ALL

SELECT
  'v_country_metrics',
  COUNT(*),
  COUNTIF(country IS NULL OR country = '' OR country = 'Unknown'),
  ROUND(100.0 * COUNTIF(country IS NULL OR country = '' OR country = 'Unknown') / COUNT(*), 2),
  COUNT(DISTINCT country)
FROM `banknote-app-4f3fd.analytics_488476338.v_country_metrics`

UNION ALL

SELECT
  'v_new_users',
  COUNT(*),
  COUNTIF(first_country IS NULL OR first_country = '' OR first_country = 'Unknown'),
  ROUND(100.0 * COUNTIF(first_country IS NULL OR first_country = '' OR first_country = 'Unknown') / COUNT(*), 2),
  COUNT(DISTINCT first_country)
FROM `banknote-app-4f3fd.analytics_488476338.v_new_users`;
