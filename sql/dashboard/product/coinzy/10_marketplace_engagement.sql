-- =============================================================================
-- Coinzy MVP #10 — Marketplace + Feed engagement (raw events)
-- Screen: marketplace_screen  ·  Contact: market_contact / market_contact_button
-- NOT Marketplace_open / contact_seller
-- =============================================================================

WITH bounds AS (
  SELECT
    FORMAT_DATE('%Y%m%d', {{start_date}}) AS start_s,
    FORMAT_DATE('%Y%m%d', {{end_date}}) AS end_s
),
base AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    COALESCE(
      user_id,
      (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'user_id'),
      user_pseudo_id
    ) AS resolved_user_id,
    REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS event_name_base
  FROM `{PROJECT}.{DATASET}.events_*`, bounds
  WHERE _TABLE_SUFFIX BETWEEN start_s AND end_s
    AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
    [[AND event_country = {{country}}]]
    [[AND event_platform = {{platform}}]]
),
flags AS (
  SELECT
    event_date,
    resolved_user_id,
    MAX(IF(event_name_base IN (
      'marketplace_screen', 'marketplace_bottom_nav', 'Marketplace_bottom_nav',
      'market_item_expolre'
    ), 1, 0)) AS marketplace,
    MAX(IF(event_name_base IN ('market_contact', 'market_contact_button'), 1, 0)) AS contacted,
    MAX(IF(event_name_base IN (
      'Feed_screen', 'feed_bottom_nav', 'feed_like', 'feed_comment', 'feed_add'
    ), 1, 0)) AS feed
  FROM base
  GROUP BY event_date, resolved_user_id
)
SELECT
  event_date,
  COUNT(*) AS dau,
  COUNTIF(marketplace = 1) AS users_marketplace,
  COUNTIF(contacted = 1) AS users_contacted_seller,
  COUNTIF(feed = 1) AS users_feed,
  SAFE_DIVIDE(COUNTIF(marketplace = 1), COUNT(*)) AS marketplace_engagement_rate,
  SAFE_DIVIDE(COUNTIF(contacted = 1), COUNTIF(marketplace = 1)) AS contact_seller_rate,
  SAFE_DIVIDE(COUNTIF(feed = 1), COUNT(*)) AS feed_engagement_rate
FROM flags
GROUP BY event_date
ORDER BY event_date;
