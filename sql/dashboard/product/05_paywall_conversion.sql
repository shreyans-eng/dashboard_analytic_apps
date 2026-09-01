-- =============================================================================
-- MVP #11 — Paywall view → purchase conversion
-- =============================================================================

SELECT
  event_date,
  SUM(paywall_impressions) AS paywall_impressions,
  SUM(users_saw_paywall) AS users_saw_paywall,
  SUM(purchase_confirms) AS purchase_confirms,
  SUM(paying_users) AS paying_users,
  SAFE_DIVIDE(SUM(paying_users), SUM(users_saw_paywall)) AS paywall_to_confirm_rate,
  SAFE_DIVIDE(SUM(paying_users), SUM(users_saw_paywall)) AS user_paywall_conversion_rate
FROM `{PROJECT}.{DATASET}.v_subscription_metrics`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY event_date
ORDER BY event_date;
