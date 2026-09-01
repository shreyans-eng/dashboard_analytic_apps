-- =============================================================================
-- Banknote packs taken — unique people per day per pack
--
-- Confirm is Subs_confirm only (not Coinzy paid_purchase / trial_purchase).
-- Pack name is on Subs_pack only (not Coinzy subs_pack). Attribute each person
-- to that day's last named pack click when the confirm event has no pack_name.
-- One row per person per day: payment retries / double-taps do not inflate
-- unique_users. takes is still raw Subs_confirm taps.
-- =============================================================================

WITH base AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    event_timestamp,
    {{resolved_user_id_cheap}} AS uid,
    REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS event_name_base,
    COALESCE(
      NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'pack_name'), ''),
      NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'product_id'), ''),
      NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'item_id'), ''),
      NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'item_name'), ''),
      '(unnamed pack)'
    ) AS pack_name
  FROM `{PROJECT}.{DATASET}.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', {{start_date}})
                          AND FORMAT_DATE('%Y%m%d', {{end_date}})
    AND _TABLE_SUFFIX NOT LIKE 'intraday_%'
    AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
    [[AND event_country = {{country}}]]
    [[AND event_platform = {{platform}}]]
),

pack_clicks AS (
  SELECT
    event_date,
    uid,
    ARRAY_AGG(
      IF(pack_name = '(unnamed pack)', NULL, pack_name) IGNORE NULLS
      ORDER BY event_timestamp DESC
      LIMIT 1
    )[SAFE_OFFSET(0)] AS pack_name
  FROM base
  WHERE uid IS NOT NULL
    AND event_name_base = 'Subs_pack'
  GROUP BY event_date, uid
),

click_people AS (
  SELECT DISTINCT event_date, uid
  FROM base
  WHERE uid IS NOT NULL
    AND event_name_base = 'Subs_pack'
),

confirms AS (
  SELECT
    c.event_date,
    c.event_timestamp,
    c.uid,
    COALESCE(
      NULLIF(c.pack_name, '(unnamed pack)'),
      p.pack_name,
      '(unnamed pack)'
    ) AS pack_name,
    CASE
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(NULLIF(c.pack_name, '(unnamed pack)'), p.pack_name, '')), r'lifetime|life_time|life.?time') THEN 'Lifetime'
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(NULLIF(c.pack_name, '(unnamed pack)'), p.pack_name, '')), r'yearly|year|annual') THEN 'Yearly'
      WHEN REGEXP_CONTAINS(LOWER(COALESCE(NULLIF(c.pack_name, '(unnamed pack)'), p.pack_name, '')), r'monthly|month') THEN 'Monthly'
      ELSE 'Other'
    END AS pack_kind
  FROM base c
  LEFT JOIN pack_clicks p
    ON p.event_date = c.event_date AND p.uid = c.uid
  WHERE c.uid IS NOT NULL
    AND c.event_name_base = 'Subs_confirm'
),
taken AS (
  SELECT
    event_date,
    uid,
    ARRAY_AGG(pack_name ORDER BY event_timestamp DESC LIMIT 1)[SAFE_OFFSET(0)] AS pack_name,
    ARRAY_AGG(pack_kind ORDER BY event_timestamp DESC LIMIT 1)[SAFE_OFFSET(0)] AS pack_kind,
    COUNT(*) AS confirm_taps
  FROM confirms
  GROUP BY event_date, uid
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
