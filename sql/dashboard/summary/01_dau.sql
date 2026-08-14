-- Exact daily DAU from common KPI summary (date grain — no double-count across dims)
-- Country/platform filters are not on this table; filtered DAU falls back via API to view/raw.
SELECT
  event_date,
  dau
FROM `{PROJECT}.{SUMMARY_DATASET}.product_daily_signals`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
ORDER BY event_date;
