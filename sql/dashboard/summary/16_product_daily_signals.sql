-- Dashboard read: common KPI daily signals from summary (MVP + Compare)
SELECT
  event_date,
  dau,
  COALESCE(app_open_dau, dau) AS app_open_dau,
  notification_dau,
  any_event_dau,
  installs,
  success_scans,
  failure_scans,
  identification_success_rate,
  scans_per_dau,
  free_quota_hit_rate,
  paywall_to_confirm_rate,
  open_to_success_rate,
  catalogue_open_rate,
  marketplace_engagement_rate,
  paying_users,
  paywall_impressions,
  purchase_confirms
FROM `{PROJECT}.{SUMMARY_DATASET}.product_daily_signals`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
ORDER BY event_date;
