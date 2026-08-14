-- =============================================================================
-- v_events_normalized
-- Base analytics layer: one row per Firebase event with flattened params.
-- Replace {PROJECT} and {DATASET} before running.
-- =============================================================================

CREATE OR REPLACE VIEW `{PROJECT}.{DATASET}.v_events_normalized` AS

WITH raw_events AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date)                          AS event_date,
    TIMESTAMP_MICROS(event_timestamp)                         AS event_timestamp,
    event_name,
    user_pseudo_id,
    user_id                                                   AS ga4_user_id,
    geo.country                                               AS geo_country,
    device.operating_system                                   AS device_os,
    device.mobile_model_name                                  AS device_model,
    app_info.version                                          AS app_version,
    app_info.id                                               AS app_id,
    platform,
    event_params,
    user_properties
  FROM `{PROJECT}.{DATASET}.events_*`
  WHERE _TABLE_SUFFIX NOT LIKE 'intraday_%'  -- use daily export; remove to include intraday
),

params_flat AS (
  SELECT
    r.*,

    -- Resolve platform
    COALESCE(
      (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'platform'),
      CASE
        WHEN REGEXP_CONTAINS(r.event_name, r'_android$') THEN 'android'
        WHEN REGEXP_CONTAINS(r.event_name, r'_ios$')     THEN 'ios'
        ELSE LOWER(r.device_os)
      END
    ) AS platform_resolved,

    -- Normalize event name (strip _android / _ios suffix)
    CASE
      WHEN REGEXP_CONTAINS(r.event_name, r'_android$')
        THEN REGEXP_REPLACE(r.event_name, r'_android$', '')
      WHEN REGEXP_CONTAINS(r.event_name, r'_ios$')
        THEN REGEXP_REPLACE(r.event_name, r'_ios$', '')
      ELSE r.event_name
    END AS event_name_base,

    -- Wrapper common params
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'user_id')              AS param_user_id,
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'country')              AS param_country,
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'scan_limit_variant')   AS scan_limit_variant,
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'quota_mode')           AS quota_mode,
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'id')                   AS param_id,
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'date')                 AS param_date,
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'time')                 AS param_time,
    (SELECT ep.value.int_value    FROM UNNEST(r.event_params) ep WHERE ep.key = 'timestamp')             AS param_timestamp,
    (SELECT ep.value.int_value    FROM UNNEST(r.event_params) ep WHERE ep.key = 'session_length_seconds') AS session_length_seconds,

    -- Auth / onboarding
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'login_type')           AS login_type,
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'registration_type')    AS registration_type,
    (SELECT ep.value.int_value    FROM UNNEST(r.event_params) ep WHERE ep.key = 'screen_index')          AS screen_index,
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'screen_name')          AS screen_name,
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'variant')              AS variant,

    -- Identification / collection
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'banknote_id')          AS banknote_id,
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'coin_id')               AS coin_id,
    (SELECT ep.value.int_value    FROM UNNEST(r.event_params) ep WHERE ep.key = 'option_number')         AS option_number,
    (SELECT ep.value.int_value    FROM UNNEST(r.event_params) ep WHERE ep.key = 'failure_limit')         AS failure_limit,
    (SELECT ep.value.int_value    FROM UNNEST(r.event_params) ep WHERE ep.key = 'failure_remaining')     AS failure_remaining,
    (SELECT ep.value.int_value    FROM UNNEST(r.event_params) ep WHERE ep.key = 'success_limit')         AS success_limit,
    (SELECT ep.value.int_value    FROM UNNEST(r.event_params) ep WHERE ep.key = 'success_remaining')     AS success_remaining,

    -- Subscription
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'pack_name')             AS pack_name,
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'discounted_type')     AS discounted_type,
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'action')              AS action,
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'error')                AS error,

    -- Filters / misc
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'filter_name')           AS filter_name,
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'filter_fields')         AS filter_fields,
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'collection_name')     AS collection_name,
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'app_name')            AS app_name,
    (SELECT ep.value.int_value    FROM UNNEST(r.event_params) ep WHERE ep.key = 'time_spent')          AS time_spent,

    -- Attribution (direct events)
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'utm_source')            AS utm_source,
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'utm_medium')            AS utm_medium,
    (SELECT ep.value.string_value FROM UNNEST(r.event_params) ep WHERE ep.key = 'utm_campaign')         AS utm_campaign,

    -- Flags
    CASE
      WHEN REGEXP_CONTAINS(r.event_name, r'_(android|ios)$') THEN FALSE
      ELSE TRUE
    END AS is_direct_event,

    CASE
      WHEN r.event_name IN (
        'first_open', 'first_open_android', 'first_open_ios',
        'App_open', 'App_open_android', 'App_open_ios'
      ) THEN TRUE
      ELSE FALSE
    END AS is_session_start_event

  FROM raw_events r
)

SELECT
  event_date,
  event_timestamp,
  event_name,
  event_name_base,
  is_direct_event,
  is_session_start_event,

  -- Identity
  user_pseudo_id,
  ga4_user_id,
  param_user_id,
  COALESCE(ga4_user_id, param_user_id, user_pseudo_id) AS resolved_user_id,

  -- Dimensions
  platform_resolved                                              AS platform,
  COALESCE(NULLIF(param_country, ''), NULLIF(geo_country, ''), 'Unknown') AS country,
  geo_country,
  app_version,
  app_id,
  device_os,
  device_model,

  -- Common wrapper params
  scan_limit_variant,
  quota_mode,
  param_id,
  session_length_seconds,

  -- Event-specific params (nullable)
  login_type,
  registration_type,
  screen_index,
  screen_name,
  variant,
  banknote_id,
  coin_id,
  option_number,
  failure_limit,
  failure_remaining,
  success_limit,
  success_remaining,
  pack_name,
  discounted_type,
  action,
  error,
  filter_name,
  filter_fields,
  collection_name,
  app_name,
  time_spent,
  utm_source,
  utm_medium,
  utm_campaign

FROM params_flat;
