-- Single lightweight KPI query from analytics_summary tables
-- Latest DAU from date-grain product_daily_signals (do not SUM country×platform slices).
-- Country/platform filters: the API skips this file and uses raw DAU instead.
WITH latest_dau AS (
  SELECT dau
  FROM `{PROJECT}.{SUMMARY_DATASET}.product_daily_signals`
  WHERE event_date = (
    SELECT MAX(event_date)
    FROM `{PROJECT}.{SUMMARY_DATASET}.product_daily_signals`
    WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  )
),
latest_mau AS (
  SELECT SUM(mau) AS mau
  FROM `{PROJECT}.{SUMMARY_DATASET}.monthly_active_users`
  WHERE activity_month = (
    SELECT MAX(activity_month)
    FROM `{PROJECT}.{SUMMARY_DATASET}.monthly_active_users`
    WHERE activity_month <= {{end_date}}
  )
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
),
new_users_agg AS (
  SELECT SUM(new_users) AS total_new_users
  FROM `{PROJECT}.{SUMMARY_DATASET}.daily_new_users`
  WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
),
retention AS (
  SELECT
    SAFE_DIVIDE(SUM(retained_d1), SUM(cohort_size)) AS d1,
    SAFE_DIVIDE(SUM(retained_d7), SUM(cohort_size)) AS d7
  FROM `{PROJECT}.{SUMMARY_DATASET}.daily_retention`
  WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
)
SELECT
  IFNULL((SELECT dau FROM latest_dau), 0) AS dau,
  IFNULL((SELECT mau FROM latest_mau), 0) AS mau,
  IFNULL((SELECT total_new_users FROM new_users_agg), 0) AS newUsers,
  IFNULL((SELECT d1 FROM retention), 0) AS d1,
  IFNULL((SELECT d7 FROM retention), 0) AS d7;
