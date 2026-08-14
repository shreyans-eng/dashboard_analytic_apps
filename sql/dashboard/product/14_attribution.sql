-- =============================================================================
-- Overview / Acquisition — install attribution quality
-- =============================================================================

SELECT
  utm_source,
  utm_campaign,
  SUM(installs) AS installs,
  SAFE_DIVIDE(SUM(users_scanned_d7), SUM(installs)) AS scan_rate_d7,
  SAFE_DIVIDE(SUM(users_paid_d30), SUM(installs)) AS paid_rate_d30
FROM `{PROJECT}.{DATASET}.v_attribution_metrics`
WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY utm_source, utm_campaign
HAVING SUM(installs) >= 10
ORDER BY installs DESC
LIMIT 50;
