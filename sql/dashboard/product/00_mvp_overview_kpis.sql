-- =============================================================================
-- PRODUCT MVP — Overview KPIs (10 metrics)
-- Removed: free-scan variant comparison
-- Added: identify funnel, catalogue, marketplace
-- =============================================================================

WITH base AS (
  SELECT
    event_date,
    dau,
    new_installs,
    scans_per_dau,
    identification_success_rate,
    free_quota_hit_rate,
    paywall_to_confirm_rate,
    day0_first_scan_rate,
    median_seconds_to_first_scan,
    paid_users,
    purchase_confirms,
    collection_add_rate_after_id
  FROM `{PROJECT}.{DATASET}.v_product_kpi_daily`
  WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
),

funnel AS (
  SELECT
    event_date,
    SAFE_DIVIDE(SUM(users_success), SUM(users_identify_open)) AS open_to_success_rate
  FROM `{PROJECT}.{DATASET}.v_identify_metrics`
  WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  GROUP BY event_date
),

eng AS (
  SELECT
    event_date,
    SAFE_DIVIDE(SUM(users_opened_collection), SUM(dau)) AS catalogue_open_rate,
    SAFE_DIVIDE(SUM(users_marketplace), SUM(dau)) AS marketplace_engagement_rate
  FROM `{PROJECT}.{DATASET}.v_engagement_metrics`
  WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  GROUP BY event_date
)

SELECT
  b.event_date,
  b.dau,                                    -- MVP 1
  b.day0_first_scan_rate,                   -- MVP 2 (time-to-first-scan proxy)
  b.median_seconds_to_first_scan,           -- MVP 2
  b.identification_success_rate,            -- MVP 3
  b.free_quota_hit_rate,                    -- MVP 4
  b.paywall_to_confirm_rate,                -- MVP 5
  b.scans_per_dau,                          -- MVP 7
  b.collection_add_rate_after_id,           -- supports MVP 9
  f.open_to_success_rate,                   -- MVP 8 Identify funnel
  e.catalogue_open_rate,                    -- MVP 9 Catalogue
  e.marketplace_engagement_rate,            -- MVP 10 Marketplace
  b.new_installs,
  b.paid_users,
  b.purchase_confirms
FROM base b
LEFT JOIN funnel f ON b.event_date = f.event_date
LEFT JOIN eng e ON b.event_date = e.event_date
ORDER BY b.event_date;
