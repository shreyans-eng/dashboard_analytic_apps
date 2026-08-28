-- Exact daily DAU from common KPI summary (date grain — no double-count across dims)
-- Country/platform filters are not on this table. The API skips this path when
-- those filters are set and runs view/raw DAU SQL instead.
SELECT
  event_date,
  COALESCE(app_open_dau, dau) AS dau
FROM `{PROJECT}.{SUMMARY_DATASET}.product_daily_signals`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
ORDER BY event_date;
