-- =============================================================================
-- MVP #10 — Marketplace engagement
-- Listing / market opens, contact seller (commerce loop).
-- =============================================================================

SELECT
  event_date,
  SUM(dau) AS dau,
  SUM(users_marketplace) AS users_marketplace,
  SUM(users_contacted_seller) AS users_contacted_seller,
  SUM(users_feed) AS users_feed,
  SAFE_DIVIDE(SUM(users_marketplace), SUM(dau)) AS marketplace_engagement_rate,
  SAFE_DIVIDE(SUM(users_contacted_seller), SUM(users_marketplace)) AS contact_seller_rate,
  SAFE_DIVIDE(SUM(users_feed), SUM(dau)) AS feed_engagement_rate
FROM `{PROJECT}.{DATASET}.v_engagement_metrics`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY event_date
ORDER BY event_date;
