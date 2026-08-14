-- =============================================================================
-- v_product_kpi_daily
-- One row per day: MVP product KPIs for Overview tab.
-- Metrics: DAU, installs, success rate, quota hit, paywall conversion,
--          scans/user, paid users (retention stays on cohort view).
-- Depends on: v_daily_active_users, v_new_users, v_identify_metrics,
--             v_time_to_first_scan, v_subscription_metrics, v_engagement_metrics
-- =============================================================================

CREATE OR REPLACE VIEW `{PROJECT}.{DATASET}.v_product_kpi_daily` AS

WITH dau AS (
  SELECT
    event_date,
    COUNT(DISTINCT resolved_user_id) AS dau,
    SUM(identifications_success) AS success_scans,
    SUM(subscription_confirms) AS subscription_confirms,
    COUNT(DISTINCT CASE WHEN subscription_confirms > 0 THEN resolved_user_id END)
      AS paid_users
  FROM `{PROJECT}.{DATASET}.v_daily_active_users`
  GROUP BY event_date
),

installs AS (
  SELECT
    cohort_date AS event_date,
    COUNT(DISTINCT resolved_user_id) AS new_installs
  FROM `{PROJECT}.{DATASET}.v_new_users`
  WHERE cohort_type = 'install' OR first_open_date IS NOT NULL
  GROUP BY cohort_date
),

identify AS (
  SELECT
    event_date,
    SUM(success_events) AS success_events,
    SUM(failure_events) AS failure_events,
    SUM(users_hit_quota) AS users_hit_quota,
    SUM(users_attempted_scan) AS users_attempted_scan,
    SAFE_DIVIDE(SUM(success_events), SUM(success_events) + SUM(failure_events))
      AS identification_success_rate,
    SAFE_DIVIDE(SUM(users_hit_quota), SUM(users_attempted_scan)) AS free_quota_hit_rate
  FROM `{PROJECT}.{DATASET}.v_identify_metrics`
  GROUP BY event_date
),

tts AS (
  SELECT
    cohort_date AS event_date,
    SAFE_DIVIDE(SUM(users_scanned_day0), SUM(cohort_users)) AS day0_first_scan_rate,
    -- weighted-ish median proxy: average of medians (good enough for KPI sparkline)
    AVG(median_seconds_to_first_scan) AS median_seconds_to_first_scan
  FROM `{PROJECT}.{DATASET}.v_time_to_first_scan`
  GROUP BY cohort_date
),

subs AS (
  SELECT
    event_date,
    SUM(paywall_impressions) AS paywall_impressions,
    SUM(purchase_confirms) AS purchase_confirms,
    SUM(paying_users) AS paying_users,
    SAFE_DIVIDE(SUM(purchase_confirms), SUM(paywall_impressions)) AS paywall_to_confirm_rate,
    SUM(purchase_failures) AS purchase_failures,
    SUM(purchase_cancels) AS purchase_cancels
  FROM `{PROJECT}.{DATASET}.v_subscription_metrics`
  GROUP BY event_date
),

eng AS (
  SELECT
    event_date,
    SAFE_DIVIDE(SUM(total_success_scans), SUM(dau)) AS scans_per_dau,
    SAFE_DIVIDE(SUM(users_added_after_id), SUM(users_with_success_id))
      AS collection_add_rate_after_id
  FROM `{PROJECT}.{DATASET}.v_engagement_metrics`
  GROUP BY event_date
)

SELECT
  d.event_date,
  d.dau,
  COALESCE(i.new_installs, 0) AS new_installs,
  d.success_scans,
  d.paid_users,
  SAFE_DIVIDE(d.success_scans, d.dau) AS scans_per_dau,
  id.identification_success_rate,
  id.free_quota_hit_rate,
  t.day0_first_scan_rate,
  t.median_seconds_to_first_scan,
  s.paywall_to_confirm_rate,
  s.paywall_impressions,
  s.purchase_confirms,
  s.purchase_failures,
  s.purchase_cancels,
  e.collection_add_rate_after_id
FROM dau d
LEFT JOIN installs i ON d.event_date = i.event_date
LEFT JOIN identify id ON d.event_date = id.event_date
LEFT JOIN tts t ON d.event_date = t.event_date
LEFT JOIN subs s ON d.event_date = s.event_date
LEFT JOIN eng e ON d.event_date = e.event_date;
