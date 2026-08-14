-- =============================================================================
-- MVP #15 — Scans per active user
-- =============================================================================

SELECT
  event_date,
  SUM(dau) AS dau,
  SUM(total_success_scans) AS success_scans,
  SAFE_DIVIDE(SUM(total_success_scans), SUM(dau)) AS scans_per_dau,
  SAFE_DIVIDE(SUM(total_success_scans), SUM(users_with_scan)) AS scans_per_scanning_user
FROM `{PROJECT}.{DATASET}.v_engagement_metrics`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY event_date
ORDER BY event_date;
