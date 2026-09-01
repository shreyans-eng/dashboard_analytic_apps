-- =============================================================================
-- Coinzy packs taken — unique people per day per store product ID
--
-- Taken = Firebase in_app_purchase / purchase (GA Product ID = items.item_id).
-- SKUs (Play US list):
--   yearly_coin_pack / yearly_coinzy_pack_trial          $29.99
--   yearly_coin_half_pack / yearly_coinzy_pack_trial_half_price  $14.99
--   monthly_coin_pack                                    $4.49
--   lifetime_coin                                        $54.99
--   lifetime_pack_half_price                             $26.99
-- Expert tokens (coinzy_expert_token) are not subscription packs.
--
-- subs_confirm / paid_purchase are NOT counted: they inflate takes vs store
-- quantity. Pack click stays subs_pack / subs_pack_discount (click → confirm).
-- One row per person per day per SKU.
-- =============================================================================

WITH base AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    event_timestamp,
    {{resolved_user_id_cheap}} AS uid,
    REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS event_name_base,
    CASE
      WHEN REGEXP_REPLACE(event_name, r'_(android|ios)$', '') IN ('in_app_purchase', 'purchase') THEN
        COALESCE(
          NULLIF((SELECT item.item_id FROM UNNEST(items) item WHERE NULLIF(item.item_id, '') IS NOT NULL LIMIT 1), ''),
          NULLIF((SELECT item.item_name FROM UNNEST(items) item WHERE NULLIF(item.item_name, '') IS NOT NULL LIMIT 1), ''),
          NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'item_id'), ''),
          NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'product_id'), ''),
          NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'item_name'), ''),
          '(unnamed pack)'
        )
      ELSE
        COALESCE(
          NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'pack_name'), ''),
          NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'product_id'), ''),
          NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'item_id'), ''),
          NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'item_name'), ''),
          '(unnamed pack)'
        )
    END AS pack_name
  FROM `{PROJECT}.{DATASET}.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', {{start_date}})
                          AND FORMAT_DATE('%Y%m%d', {{end_date}})
    AND _TABLE_SUFFIX NOT LIKE 'intraday_%'
    AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
    [[AND event_country = {{country}}]]
    [[AND event_platform = {{platform}}]]
),

click_people AS (
  SELECT DISTINCT event_date, uid
  FROM base
  WHERE uid IS NOT NULL
    AND event_name_base IN ('subs_pack', 'subs_pack_discount')
),

purchases AS (
  SELECT
    event_date,
    uid,
    pack_name,
    CASE
      WHEN REGEXP_CONTAINS(pk, r'lifetime_pack_half_price|lifetime_coin') THEN 'Lifetime'
      WHEN REGEXP_CONTAINS(pk, r'yearly_coinzy_pack_trial_half_price|yearly_coinzy_pack_trial|yearly_coin_half_pack|yearly_coin_pack') THEN 'Yearly'
      WHEN REGEXP_CONTAINS(pk, r'monthly_coin_pack') THEN 'Monthly'
      WHEN REGEXP_CONTAINS(pk, r'lifetime|life_time|life.?time') THEN 'Lifetime'
      WHEN REGEXP_CONTAINS(pk, r'yearly|year|annual') THEN 'Yearly'
      WHEN REGEXP_CONTAINS(pk, r'monthly|month') THEN 'Monthly'
      ELSE 'Other'
    END AS pack_kind
  FROM (
    SELECT
      event_date,
      uid,
      pack_name,
      LOWER(pack_name) AS pk
    FROM base
    WHERE uid IS NOT NULL
      AND event_name_base IN ('in_app_purchase', 'purchase')
      AND pack_name != '(unnamed pack)'
      AND REGEXP_CONTAINS(LOWER(pack_name), r'yearly_coinzy_pack_trial|yearly_coin_half_pack|yearly_coin_pack|monthly_coin_pack|lifetime_pack_half_price|lifetime_coin')
  )
),

taken AS (
  SELECT
    event_date,
    uid,
    pack_name,
    pack_kind,
    COUNT(*) AS confirm_taps
  FROM purchases
  GROUP BY event_date, uid, pack_name, pack_kind
)

SELECT
  'day' AS grain,
  event_date,
  pack_name,
  pack_kind,
  COUNT(DISTINCT uid) AS unique_users,
  SUM(confirm_taps) AS takes
FROM taken
GROUP BY grain, event_date, pack_name, pack_kind

UNION ALL

SELECT
  'day' AS grain,
  event_date,
  '(all packs)' AS pack_name,
  'All' AS pack_kind,
  COUNT(DISTINCT uid) AS unique_users,
  SUM(confirm_taps) AS takes
FROM taken
GROUP BY grain, event_date, pack_name, pack_kind

UNION ALL

SELECT
  'day' AS grain,
  event_date,
  '(yearly)' AS pack_name,
  'Yearly' AS pack_kind,
  COUNT(DISTINCT uid) AS unique_users,
  SUM(confirm_taps) AS takes
FROM taken
WHERE pack_kind = 'Yearly'
GROUP BY grain, event_date, pack_name, pack_kind

UNION ALL

SELECT
  'day' AS grain,
  event_date,
  '(monthly)' AS pack_name,
  'Monthly' AS pack_kind,
  COUNT(DISTINCT uid) AS unique_users,
  SUM(confirm_taps) AS takes
FROM taken
WHERE pack_kind = 'Monthly'
GROUP BY grain, event_date, pack_name, pack_kind

UNION ALL

SELECT
  'day' AS grain,
  event_date,
  '(lifetime)' AS pack_name,
  'Lifetime' AS pack_kind,
  COUNT(DISTINCT uid) AS unique_users,
  SUM(confirm_taps) AS takes
FROM taken
WHERE pack_kind = 'Lifetime'
GROUP BY grain, event_date, pack_name, pack_kind

UNION ALL

SELECT
  'day' AS grain,
  event_date,
  '(pack clicks)' AS pack_name,
  'Clicks' AS pack_kind,
  COUNT(DISTINCT uid) AS unique_users,
  0 AS takes
FROM click_people
GROUP BY grain, event_date, pack_name, pack_kind

UNION ALL

SELECT
  'range' AS grain,
  CAST(NULL AS DATE) AS event_date,
  pack_name,
  pack_kind,
  COUNT(DISTINCT uid) AS unique_users,
  SUM(confirm_taps) AS takes
FROM taken
GROUP BY grain, event_date, pack_name, pack_kind

UNION ALL

SELECT
  'range' AS grain,
  CAST(NULL AS DATE) AS event_date,
  '(all packs)' AS pack_name,
  'All' AS pack_kind,
  COUNT(DISTINCT uid) AS unique_users,
  SUM(confirm_taps) AS takes
FROM taken

UNION ALL

SELECT
  'range' AS grain,
  CAST(NULL AS DATE) AS event_date,
  '(yearly)' AS pack_name,
  'Yearly' AS pack_kind,
  COUNT(DISTINCT uid) AS unique_users,
  SUM(confirm_taps) AS takes
FROM taken
WHERE pack_kind = 'Yearly'

UNION ALL

SELECT
  'range' AS grain,
  CAST(NULL AS DATE) AS event_date,
  '(monthly)' AS pack_name,
  'Monthly' AS pack_kind,
  COUNT(DISTINCT uid) AS unique_users,
  SUM(confirm_taps) AS takes
FROM taken
WHERE pack_kind = 'Monthly'

UNION ALL

SELECT
  'range' AS grain,
  CAST(NULL AS DATE) AS event_date,
  '(lifetime)' AS pack_name,
  'Lifetime' AS pack_kind,
  COUNT(DISTINCT uid) AS unique_users,
  SUM(confirm_taps) AS takes
FROM taken
WHERE pack_kind = 'Lifetime'

UNION ALL

SELECT
  'range' AS grain,
  CAST(NULL AS DATE) AS event_date,
  '(pack clicks)' AS pack_name,
  'Clicks' AS pack_kind,
  COUNT(DISTINCT uid) AS unique_users,
  0 AS takes
FROM click_people

ORDER BY grain, event_date, unique_users DESC;
