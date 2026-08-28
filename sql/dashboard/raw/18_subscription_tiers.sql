-- =============================================================================
-- Subscription tier mix — Monthly / Yearly / Lifetime (one app / one dataset)
-- Revenue: in_app_purchase + purchase USD only (refunds subtract). Same as LTV.
-- Purchases: IAP events + life_time_access (excludes Subs_confirm custom events).
-- Used for Compare and per-product subscription breakdown.
-- =============================================================================

WITH base AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    COALESCE(user_id, user_pseudo_id) AS resolved_user_id,
    REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS event_name_base,
    COALESCE(
      NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'pack_name'), ''),
      NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'product_id'), ''),
      NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'item_id'), ''),
      ''
    ) AS pack_or_product,
    COALESCE(
      event_value_in_usd,
      (SELECT ep.value.double_value FROM UNNEST(event_params) ep WHERE ep.key = 'value'),
      (SELECT ep.value.float_value FROM UNNEST(event_params) ep WHERE ep.key = 'value'),
      SAFE_CAST((SELECT ep.value.int_value FROM UNNEST(event_params) ep WHERE ep.key = 'value') AS FLOAT64)
    ) AS amount_usd
  FROM `{PROJECT}.{DATASET}.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', {{start_date}})
                          AND FORMAT_DATE('%Y%m%d', {{end_date}})
    AND _TABLE_SUFFIX NOT LIKE 'intraday_%'
    AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
    [[AND event_country = {{country}}]]
    [[AND event_platform = {{platform}}]]
),

purchase_events AS (
  SELECT
    event_date,
    resolved_user_id,
    event_name_base,
    pack_or_product,
    CASE
      WHEN event_name_base = 'refund' THEN -ABS(amount_usd)
      ELSE amount_usd
    END AS amount_usd
  FROM base
  WHERE event_name_base IN ('in_app_purchase', 'purchase', 'refund', 'life_time_access')
    AND (
      event_name_base = 'life_time_access'
      OR amount_usd IS NOT NULL
    )
),

classified AS (
  SELECT
    event_date,
    resolved_user_id,
    event_name_base,
    pack_or_product,
    amount_usd,
    CASE
      WHEN event_name_base = 'life_time_access' THEN 'Lifetime'
      WHEN REGEXP_CONTAINS(LOWER(pack_or_product), r'lifetime|life_time|life.?time') THEN 'Lifetime'
      WHEN REGEXP_CONTAINS(LOWER(pack_or_product), r'yearly|year|annual') THEN 'Yearly'
      WHEN REGEXP_CONTAINS(LOWER(pack_or_product), r'monthly|month') THEN 'Monthly'
      ELSE NULL
    END AS subscription_tier
  FROM purchase_events
  WHERE event_name_base != 'refund' OR amount_usd IS NOT NULL
)

SELECT
  subscription_tier,
  COUNTIF(event_name_base IN ('in_app_purchase', 'purchase', 'life_time_access')) AS purchases,
  COUNT(DISTINCT CASE
    WHEN event_name_base IN ('in_app_purchase', 'purchase', 'life_time_access')
    THEN resolved_user_id
  END) AS paying_users,
  SUM(CASE
    WHEN event_name_base IN ('in_app_purchase', 'purchase', 'refund', 'life_time_access')
      AND amount_usd IS NOT NULL
    THEN amount_usd
    ELSE 0
  END) AS revenue_usd
FROM classified
WHERE subscription_tier IS NOT NULL
GROUP BY subscription_tier
ORDER BY
  CASE subscription_tier
    WHEN 'Monthly' THEN 1
    WHEN 'Yearly' THEN 2
    WHEN 'Lifetime' THEN 3
    ELSE 4
  END;
