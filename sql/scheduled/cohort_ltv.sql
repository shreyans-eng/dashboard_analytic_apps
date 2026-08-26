-- =============================================================================
-- Scheduled / refresh: cohort_ltv
-- Grain: cohort_date × country × install_channel × platform
-- Source: raw Firebase events_* (never mutates raw)
-- Placeholders: {PROJECT} {DATASET} {SUMMARY_DATASET} {START_SUFFIX} {END_SUFFIX}
-- =============================================================================

CREATE TABLE IF NOT EXISTS `{PROJECT}.{SUMMARY_DATASET}.cohort_ltv` (
  cohort_date       DATE      NOT NULL,
  country           STRING    NOT NULL,
  install_channel   STRING    NOT NULL,
  platform          STRING,
  installs          INT64     NOT NULL,
  revenue_30        FLOAT64,
  revenue_90        FLOAT64,
  revenue_180       FLOAT64,
  ltv_30            FLOAT64,
  ltv_90            FLOAT64,
  ltv_180           FLOAT64,
  payers_30         INT64,
  payers_90         INT64,
  payers_180        INT64,
  paid_rate_30      FLOAT64,
  paid_rate_90      FLOAT64,
  paid_rate_180     FLOAT64,
  refreshed_at      TIMESTAMP NOT NULL
)
PARTITION BY cohort_date
CLUSTER BY install_channel, country;

DELETE FROM `{PROJECT}.{SUMMARY_DATASET}.cohort_ltv`
WHERE cohort_date BETWEEN PARSE_DATE('%Y%m%d', '{START_SUFFIX}')
                     AND PARSE_DATE('%Y%m%d', '{END_SUFFIX}');

INSERT INTO `{PROJECT}.{SUMMARY_DATASET}.cohort_ltv`
WITH bounds AS (
  SELECT
    PARSE_DATE('%Y%m%d', '{START_SUFFIX}') AS cohort_start,
    PARSE_DATE('%Y%m%d', '{END_SUFFIX}') AS cohort_end,
    LEAST(
      DATE_ADD(PARSE_DATE('%Y%m%d', '{END_SUFFIX}'), INTERVAL 180 DAY),
      CURRENT_DATE()
    ) AS purchase_end
),

events_in_window AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    TIMESTAMP_MICROS(event_timestamp) AS event_timestamp,
    COALESCE(
      user_id,
      (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'user_id'),
      user_pseudo_id
    ) AS resolved_user_id,
    REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS event_name_base,
    event_name,
    event_value_in_usd,
    geo.country AS geo_country,
    device.operating_system AS device_os,
    platform,
    traffic_source.source AS ts_source,
    traffic_source.medium AS ts_medium,
    traffic_source.name AS ts_campaign,
    collected_traffic_source.manual_source AS cts_source,
    collected_traffic_source.manual_medium AS cts_medium,
    collected_traffic_source.gclid AS cts_gclid,
    (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'country') AS param_country,
    (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'platform') AS param_platform,
    (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'utm_source') AS utm_source,
    (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'utm_medium') AS utm_medium,
    COALESCE(
      event_value_in_usd,
      (SELECT ep.value.double_value FROM UNNEST(event_params) ep WHERE ep.key = 'value'),
      (SELECT ep.value.float_value FROM UNNEST(event_params) ep WHERE ep.key = 'value'),
      SAFE_CAST((SELECT ep.value.int_value FROM UNNEST(event_params) ep WHERE ep.key = 'value') AS FLOAT64)
    ) AS amount_usd
  FROM `{PROJECT}.{DATASET}.events_*`, bounds
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', cohort_start)
                          AND FORMAT_DATE('%Y%m%d', purchase_end)
    AND _TABLE_SUFFIX NOT LIKE 'intraday_%'
    AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
    AND REGEXP_REPLACE(event_name, r'_(android|ios)$', '') IN (
      'first_open', 'in_app_purchase', 'purchase', 'refund'
    )
),

installs AS (
  SELECT
    resolved_user_id,
    event_date AS cohort_date,
    COALESCE(NULLIF(param_country, ''), NULLIF(geo_country, ''), 'Unknown') AS country,
    LOWER(COALESCE(
      NULLIF(param_platform, ''),
      CASE
        WHEN REGEXP_CONTAINS(event_name, r'_android$') THEN 'android'
        WHEN REGEXP_CONTAINS(event_name, r'_ios$') THEN 'ios'
        ELSE device_os
      END
    )) AS platform,
    LOWER(COALESCE(NULLIF(ts_source, ''), NULLIF(cts_source, ''), NULLIF(utm_source, ''), '')) AS src,
    LOWER(COALESCE(NULLIF(ts_medium, ''), NULLIF(cts_medium, ''), NULLIF(utm_medium, ''), '')) AS medium,
    LOWER(COALESCE(NULLIF(ts_campaign, ''), '')) AS campaign,
    COALESCE(cts_gclid, '') AS gclid,
    event_timestamp
  FROM events_in_window
  WHERE event_name_base = 'first_open'
),

cohorts AS (
  SELECT
    resolved_user_id,
    ARRAY_AGG(
      STRUCT(cohort_date, country, platform, src, medium, campaign, gclid)
      ORDER BY event_timestamp
      LIMIT 1
    )[OFFSET(0)] AS touch
  FROM installs
  GROUP BY resolved_user_id
),

attributed AS (
  SELECT
    resolved_user_id,
    touch.cohort_date AS cohort_date,
    COALESCE(NULLIF(touch.country, ''), 'Unknown') AS country,
    touch.platform AS platform,
    CASE
      WHEN touch.gclid != ''
        OR touch.medium IN (
          'cpc', 'ppc', 'cpm', 'cpv', 'cpa', 'cpi', 'cpe',
          'paid', 'paidsocial', 'paid-social', 'paid_social',
          'display', 'video', 'shopping', 'uac', 'uai'
        )
        OR touch.medium LIKE '%paid%'
        THEN 'Paid'
      WHEN touch.medium IN ('organic', 'organic-search')
        OR (
          touch.src IN ('google-play', 'googleplay', 'play.google.com', 'itunes', 'appstore', 'app-store', 'apple')
          AND touch.medium NOT LIKE '%paid%'
        )
        THEN 'Organic'
      WHEN touch.src IN ('(direct)', 'direct', '')
        AND touch.medium IN ('(none)', 'none', '', '(direct)')
        THEN 'Direct'
      WHEN touch.src IN ('google-play', 'googleplay', 'itunes', 'appstore', 'apple')
        THEN 'Organic'
      WHEN touch.src != '' OR (touch.medium != '' AND touch.medium NOT IN ('(none)', 'none'))
        THEN 'Organic'
      ELSE 'Direct'
    END AS install_channel
  FROM cohorts
  CROSS JOIN bounds
  WHERE touch.cohort_date BETWEEN bounds.cohort_start AND bounds.cohort_end
),

purchases AS (
  SELECT
    resolved_user_id,
    event_date AS purchase_date,
    CASE
      WHEN event_name_base = 'refund' THEN -ABS(amount_usd)
      ELSE amount_usd
    END AS amount_usd
  FROM events_in_window
  WHERE event_name_base IN ('in_app_purchase', 'purchase', 'refund')
    AND amount_usd IS NOT NULL
),

user_ltv AS (
  SELECT
    a.resolved_user_id,
    a.cohort_date,
    a.country,
    a.platform,
    a.install_channel,
    DATE_DIFF(CURRENT_DATE(), a.cohort_date, DAY) AS cohort_age_days,
    SUM(IF(p.purchase_date BETWEEN a.cohort_date AND DATE_ADD(a.cohort_date, INTERVAL 29 DAY), p.amount_usd, 0)) AS revenue_30,
    SUM(IF(p.purchase_date BETWEEN a.cohort_date AND DATE_ADD(a.cohort_date, INTERVAL 89 DAY), p.amount_usd, 0)) AS revenue_90,
    SUM(IF(p.purchase_date BETWEEN a.cohort_date AND DATE_ADD(a.cohort_date, INTERVAL 179 DAY), p.amount_usd, 0)) AS revenue_180
  FROM attributed a
  LEFT JOIN purchases p
    ON p.resolved_user_id = a.resolved_user_id
   AND p.purchase_date >= a.cohort_date
  GROUP BY
    a.resolved_user_id, a.cohort_date, a.country, a.platform, a.install_channel
)

SELECT
  cohort_date,
  country,
  install_channel,
  platform,
  COUNT(*) AS installs,
  IF(MAX(cohort_age_days) >= 30, SUM(revenue_30), NULL) AS revenue_30,
  IF(MAX(cohort_age_days) >= 90, SUM(revenue_90), NULL) AS revenue_90,
  IF(MAX(cohort_age_days) >= 180, SUM(revenue_180), NULL) AS revenue_180,
  IF(MAX(cohort_age_days) >= 30, SAFE_DIVIDE(SUM(revenue_30), COUNT(*)), NULL) AS ltv_30,
  IF(MAX(cohort_age_days) >= 90, SAFE_DIVIDE(SUM(revenue_90), COUNT(*)), NULL) AS ltv_90,
  IF(MAX(cohort_age_days) >= 180, SAFE_DIVIDE(SUM(revenue_180), COUNT(*)), NULL) AS ltv_180,
  IF(MAX(cohort_age_days) >= 30, COUNTIF(revenue_30 > 0), NULL) AS payers_30,
  IF(MAX(cohort_age_days) >= 90, COUNTIF(revenue_90 > 0), NULL) AS payers_90,
  IF(MAX(cohort_age_days) >= 180, COUNTIF(revenue_180 > 0), NULL) AS payers_180,
  IF(MAX(cohort_age_days) >= 30, SAFE_DIVIDE(COUNTIF(revenue_30 > 0), COUNT(*)), NULL) AS paid_rate_30,
  IF(MAX(cohort_age_days) >= 90, SAFE_DIVIDE(COUNTIF(revenue_90 > 0), COUNT(*)), NULL) AS paid_rate_90,
  IF(MAX(cohort_age_days) >= 180, SAFE_DIVIDE(COUNTIF(revenue_180 > 0), COUNT(*)), NULL) AS paid_rate_180,
  CURRENT_TIMESTAMP() AS refreshed_at
FROM user_ltv
GROUP BY cohort_date, country, install_channel, platform;
