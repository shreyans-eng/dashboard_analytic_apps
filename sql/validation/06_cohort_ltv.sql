-- =============================================================================
-- Validation: cohort LTV reconciliation
-- Run after refresh against `{PROJECT}.{SUMMARY_DATASET}.cohort_ltv`
-- Replace placeholders or run from the dashboard SQL editor with product selected.
-- Expected: each check returns 0 rows (except the channel coverage probe).
-- =============================================================================

-- 1) Cumulative LTV must not decrease: LTV-180 >= LTV-90 >= LTV-30 (mature rows only)
SELECT
  cohort_date,
  country,
  install_channel,
  platform,
  ltv_30,
  ltv_90,
  ltv_180
FROM `{PROJECT}.{SUMMARY_DATASET}.cohort_ltv`
WHERE (ltv_90 IS NOT NULL AND ltv_30 IS NOT NULL AND ltv_90 < ltv_30 - 1e-9)
   OR (ltv_180 IS NOT NULL AND ltv_90 IS NOT NULL AND ltv_180 < ltv_90 - 1e-9)
ORDER BY cohort_date DESC
LIMIT 50;

-- 2) Channel is only Organic / Paid / Direct
SELECT install_channel, COUNT(*) AS rows, SUM(installs) AS installs
FROM `{PROJECT}.{SUMMARY_DATASET}.cohort_ltv`
WHERE install_channel NOT IN ('Organic', 'Paid', 'Direct')
GROUP BY install_channel;

-- 3) Immature LTV must be NULL
--    age < 30 → all LTV NULL; age < 90 → ltv_90/180 NULL; age < 180 → ltv_180 NULL
SELECT
  cohort_date,
  DATE_DIFF(CURRENT_DATE(), cohort_date, DAY) AS age_days,
  ltv_30,
  ltv_90,
  ltv_180
FROM `{PROJECT}.{SUMMARY_DATASET}.cohort_ltv`
WHERE (DATE_DIFF(CURRENT_DATE(), cohort_date, DAY) < 30 AND ltv_30 IS NOT NULL)
   OR (DATE_DIFF(CURRENT_DATE(), cohort_date, DAY) < 90 AND ltv_90 IS NOT NULL)
   OR (DATE_DIFF(CURRENT_DATE(), cohort_date, DAY) < 180 AND ltv_180 IS NOT NULL)
LIMIT 50;

-- 4) Grain uniqueness: one row per cohort_date × country × install_channel × platform
SELECT
  cohort_date,
  country,
  install_channel,
  platform,
  COUNT(*) AS row_count
FROM `{PROJECT}.{SUMMARY_DATASET}.cohort_ltv`
GROUP BY cohort_date, country, install_channel, platform
HAVING COUNT(*) > 1
LIMIT 50;

-- 5) Organic + Paid + Direct must equal total installs (no dropped / extra channel)
SELECT
  cohort_date,
  SUM(installs) AS total_installs,
  SUM(IF(install_channel IN ('Organic', 'Paid', 'Direct'), installs, 0)) AS classified_installs
FROM `{PROJECT}.{SUMMARY_DATASET}.cohort_ltv`
GROUP BY cohort_date
HAVING SUM(installs) != SUM(IF(install_channel IN ('Organic', 'Paid', 'Direct'), installs, 0))
LIMIT 50;

-- 6) Country buckets (including Unknown / (not set)) must sum to the cohort total
SELECT
  a.cohort_date,
  a.installs_all AS installs_all,
  b.installs_by_country AS installs_by_country
FROM (
  SELECT cohort_date, SUM(installs) AS installs_all
  FROM `{PROJECT}.{SUMMARY_DATASET}.cohort_ltv`
  GROUP BY cohort_date
) a
JOIN (
  SELECT cohort_date, SUM(installs) AS installs_by_country
  FROM `{PROJECT}.{SUMMARY_DATASET}.cohort_ltv`
  GROUP BY cohort_date
) b USING (cohort_date)
WHERE a.installs_all != b.installs_by_country
LIMIT 50;

-- 7) Channel coverage probe (not a failure): installs by channel for the latest 14 cohort days
SELECT
  install_channel,
  SUM(installs) AS installs
FROM `{PROJECT}.{SUMMARY_DATASET}.cohort_ltv`
WHERE cohort_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
GROUP BY install_channel
ORDER BY install_channel;
