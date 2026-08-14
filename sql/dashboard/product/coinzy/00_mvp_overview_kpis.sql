-- =============================================================================
-- Coinzy — MVP overview KPIs (same formulas as Banknote)
-- Diff: optional app_name filter when both apps share one Firebase export.
-- Prefer parent ../00_mvp_overview_kpis.sql until product-split KPI view exists.
-- =============================================================================

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
  purchase_confirms
FROM `{PROJECT}.{DATASET}.v_product_kpi_daily`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
ORDER BY event_date;

-- When filtering Coinzy at event level (example for custom cards):
-- FROM v_events_normalized
-- WHERE (app_name = 'Coinzy' OR LOWER(app_name) LIKE '%coinzy%')
