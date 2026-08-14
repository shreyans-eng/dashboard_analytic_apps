-- =============================================================================
-- Monetization tab — fail & cancel rates
-- =============================================================================

SELECT
  event_date,
  SUM(purchase_confirms) AS confirms,
  SUM(purchase_failures) AS failures,
  SUM(purchase_cancels) AS cancels,
  SAFE_DIVIDE(
    SUM(purchase_failures),
    SUM(purchase_failures) + SUM(purchase_confirms)
  ) AS failure_rate,
  SAFE_DIVIDE(SUM(purchase_cancels), SUM(users_saw_paywall)) AS cancel_per_paywall_user
FROM `{PROJECT}.{DATASET}.v_subscription_metrics`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY event_date
ORDER BY event_date;
