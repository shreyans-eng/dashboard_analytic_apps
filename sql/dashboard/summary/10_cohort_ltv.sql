-- Dashboard read: cohort LTV from summary (Explorer LTV tab)
SELECT
  cohort_date,
  country,
  install_channel,
  SUM(installs) AS installs,
  SUM(revenue_30) AS revenue_30,
  SUM(revenue_90) AS revenue_90,
  SUM(revenue_180) AS revenue_180,
  SAFE_DIVIDE(SUM(revenue_30), SUM(IF(revenue_30 IS NOT NULL, installs, 0))) AS ltv_30,
  SAFE_DIVIDE(SUM(revenue_90), SUM(IF(revenue_90 IS NOT NULL, installs, 0))) AS ltv_90,
  SAFE_DIVIDE(SUM(revenue_180), SUM(IF(revenue_180 IS NOT NULL, installs, 0))) AS ltv_180,
  SUM(payers_30) AS payers_30,
  SUM(payers_90) AS payers_90,
  SUM(payers_180) AS payers_180,
  SAFE_DIVIDE(SUM(payers_30), SUM(IF(payers_30 IS NOT NULL, installs, 0))) AS paid_rate_30,
  SAFE_DIVIDE(SUM(payers_90), SUM(IF(payers_90 IS NOT NULL, installs, 0))) AS paid_rate_90,
  SAFE_DIVIDE(SUM(payers_180), SUM(IF(payers_180 IS NOT NULL, installs, 0))) AS paid_rate_180
FROM `{PROJECT}.{SUMMARY_DATASET}.cohort_ltv`
WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
  [[AND country = {{country}}]]
  [[AND platform = {{platform}}]]
  [[AND install_channel = {{install_channel}}]]
GROUP BY cohort_date, country, install_channel
ORDER BY cohort_date, country, install_channel;
