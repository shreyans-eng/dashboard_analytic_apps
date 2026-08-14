-- =============================================================================
-- v_attribution_metrics
-- Install attribution: which campaigns bring users who scan and subscribe.
-- Metric #3
-- Depends on: v_events_normalized, v_new_users
-- =============================================================================

CREATE OR REPLACE VIEW `{PROJECT}.{DATASET}.v_attribution_metrics` AS

WITH install_touch AS (
  -- First attribution params seen on/near install (first_open or earliest utm)
  SELECT
    resolved_user_id,
    ARRAY_AGG(
      STRUCT(
        utm_source,
        utm_medium,
        utm_campaign,
        platform,
        country,
        event_timestamp
      )
      ORDER BY
        CASE WHEN event_name_base IN ('first_open', 'first_open_android', 'first_open_ios')
             THEN 0 ELSE 1 END,
        event_timestamp
      LIMIT 1
    )[OFFSET(0)] AS touch
  FROM `{PROJECT}.{DATASET}.v_events_normalized`
  WHERE resolved_user_id IS NOT NULL
    AND (
      event_name_base IN ('first_open', 'first_open_android', 'first_open_ios')
      OR utm_source IS NOT NULL
      OR utm_campaign IS NOT NULL
    )
  GROUP BY resolved_user_id
),

attributed_users AS (
  SELECT
    n.resolved_user_id,
    n.cohort_date,
    COALESCE(NULLIF(t.touch.utm_source, ''), '(direct)') AS utm_source,
    COALESCE(NULLIF(t.touch.utm_medium, ''), '(none)') AS utm_medium,
    COALESCE(NULLIF(t.touch.utm_campaign, ''), '(none)') AS utm_campaign,
    COALESCE(t.touch.platform, n.first_platform) AS platform,
    COALESCE(t.touch.country, n.first_country) AS country
  FROM `{PROJECT}.{DATASET}.v_new_users` n
  LEFT JOIN install_touch t
    ON n.resolved_user_id = t.resolved_user_id
  WHERE n.cohort_date IS NOT NULL
),

outcomes AS (
  SELECT
    a.resolved_user_id,
    a.cohort_date,
    a.utm_source,
    a.utm_medium,
    a.utm_campaign,
    a.platform,
    a.country,
    MAX(IF(d.identifications_success > 0, 1, 0)) AS ever_scanned,
    MAX(IF(d.identifications_success > 0
           AND d.event_date BETWEEN a.cohort_date AND DATE_ADD(a.cohort_date, INTERVAL 6 DAY),
           1, 0)) AS scanned_d7,
    MAX(IF(d.subscription_confirms > 0, 1, 0)) AS ever_paid,
    MAX(IF(d.subscription_confirms > 0
           AND d.event_date BETWEEN a.cohort_date AND DATE_ADD(a.cohort_date, INTERVAL 29 DAY),
           1, 0)) AS paid_d30
  FROM attributed_users a
  LEFT JOIN `{PROJECT}.{DATASET}.v_daily_active_users` d
    ON a.resolved_user_id = d.resolved_user_id
   AND d.event_date >= a.cohort_date
  GROUP BY
    a.resolved_user_id, a.cohort_date, a.utm_source, a.utm_medium,
    a.utm_campaign, a.platform, a.country
)

SELECT
  cohort_date,
  utm_source,
  utm_medium,
  utm_campaign,
  platform,
  country,

  COUNT(DISTINCT resolved_user_id) AS installs,
  SUM(scanned_d7) AS users_scanned_d7,
  SUM(ever_scanned) AS users_ever_scanned,
  SUM(paid_d30) AS users_paid_d30,
  SUM(ever_paid) AS users_ever_paid,

  SAFE_DIVIDE(SUM(scanned_d7), COUNT(DISTINCT resolved_user_id)) AS scan_rate_d7,
  SAFE_DIVIDE(SUM(paid_d30), COUNT(DISTINCT resolved_user_id)) AS paid_rate_d30

FROM outcomes
GROUP BY cohort_date, utm_source, utm_medium, utm_campaign, platform, country;
