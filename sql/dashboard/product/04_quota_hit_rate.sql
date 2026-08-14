-- =============================================================================
-- MVP #9 — Free scan quota hit rate
-- =============================================================================

SELECT
  event_date,
  SUM(users_hit_quota) AS users_hit_quota,
  SUM(users_attempted_scan) AS users_attempted_scan,
  SAFE_DIVIDE(SUM(users_hit_quota), SUM(users_attempted_scan)) AS free_quota_hit_rate
FROM `{PROJECT}.{DATASET}.v_identify_metrics`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY event_date
ORDER BY event_date;
