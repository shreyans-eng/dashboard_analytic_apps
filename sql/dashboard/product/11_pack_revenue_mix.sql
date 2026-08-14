-- =============================================================================
-- Monetization tab — pack mix (Subs_confirm by pack_name)
-- =============================================================================

SELECT
  event_date,
  platform,
  country,
  COALESCE(NULLIF(pack_name, ''), '(unknown)') AS pack_name,
  COUNT(*) AS confirms,
  COUNT(DISTINCT resolved_user_id) AS paying_users
FROM `{PROJECT}.{DATASET}.v_events_normalized`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  AND event_name_base IN (
    'Subs_confirm', 'subs_confirm', 'subs_confirm_discount', 'paid_purchase'
  )
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
GROUP BY event_date, platform, country, pack_name
ORDER BY event_date, confirms DESC;
