-- =============================================================================
-- Banknote MVP #9 — Private collection vs global catalogue (raw events)
-- Separate rates. Collection_screen is NOT mixed with Global_catalogue_screen.
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
      'Collection_screen', 'private_collection_bottom_nav'
    ), 1, 0)) AS opened_private,
    MAX(IF(event_name_base IN (
      'Global_catalogue_screen', 'Global_catalogue'
    ), 1, 0)) AS opened_global,
    MAX(IF(event_name_base IN (
      'banknote_details_collection', 'banknote_details_global',
      'banknote_details_identification', 'identification_details_screen'
    ), 1, 0)) AS viewed_detail,
    MAX(IF(event_name_base IN (
      'identification_done_success', 'Identification_done_success'
    ), 1, 0)) AS had_success,
    MAX(IF(STARTS_WITH(event_name_base, 'Added_to_collection'), 1, 0)) AS added
  FROM base
  GROUP BY event_date, resolved_user_id
)
SELECT
  event_date,
  COUNT(*) AS dau,
  COUNTIF(opened_private = 1) AS users_opened_private_collection,
  COUNTIF(opened_global = 1) AS users_opened_global_catalogue,
  COUNTIF(viewed_detail = 1) AS users_viewed_detail,
  COUNTIF(had_success = 1) AS users_with_success_id,
  COUNTIF(had_success = 1 AND added = 1) AS users_added_after_id,
  SAFE_DIVIDE(COUNTIF(opened_private = 1), COUNT(*)) AS private_collection_open_rate,
  SAFE_DIVIDE(COUNTIF(opened_global = 1), COUNT(*)) AS global_catalogue_open_rate,
  SAFE_DIVIDE(COUNTIF(viewed_detail = 1), COUNT(*)) AS catalogue_detail_rate,
  SAFE_DIVIDE(
    COUNTIF(had_success = 1 AND added = 1),
    COUNTIF(had_success = 1)
  ) AS collection_add_rate_after_id
FROM flags
GROUP BY event_date
ORDER BY event_date;
