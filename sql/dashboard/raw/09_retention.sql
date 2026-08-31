-- =============================================================================
-- Raw-events D1 / D4 / D7 retention (no views required)
-- Cohort = first_open day.
-- Returned = opened the app that offset day (session_start / App_open / first_open).
-- Push / notification / other Firebase events do not count as a return.
-- Activity window extends end_date by 7 days so D7 cohorts can mature.
-- =============================================================================

WITH params AS (
  SELECT
    {{start_date}} AS start_date,
    {{end_date}} AS end_date,
    DATE_ADD({{end_date}}, INTERVAL 7 DAY) AS activity_end
),

user_events AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    COALESCE(
      user_id,
      (SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'user_id'),
      user_pseudo_id
    ) AS resolved_user_id,
    REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS event_name_base
  FROM `{PROJECT}.{DATASET}.events_*`, params
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', start_date)
                          AND FORMAT_DATE('%Y%m%d', activity_end)
    AND _TABLE_SUFFIX NOT LIKE 'intraday_%'
    AND {{dau_event_predicate}}
    [[AND event_country = {{country}}]]
    [[AND event_platform = {{platform}}]]
),

cohorts AS (
  SELECT
    resolved_user_id,
    MIN(event_date) AS cohort_date
  FROM user_events
  WHERE event_name_base IN ('first_open')
     OR REGEXP_CONTAINS(event_name_base, r'^first_open')
  GROUP BY resolved_user_id
),

activity AS (
  SELECT DISTINCT
    resolved_user_id,
    event_date AS activity_date
  FROM user_events
),

cohort_flags AS (
  SELECT
    c.cohort_date,
    c.resolved_user_id,
    MAX(IF(a.activity_date = DATE_ADD(c.cohort_date, INTERVAL 1 DAY), 1, 0)) AS returned_d1,
    MAX(IF(a.activity_date = DATE_ADD(c.cohort_date, INTERVAL 4 DAY), 1, 0)) AS returned_d4,
    MAX(IF(a.activity_date = DATE_ADD(c.cohort_date, INTERVAL 7 DAY), 1, 0)) AS returned_d7,
    MAX(IF(a.activity_date BETWEEN DATE_ADD(c.cohort_date, INTERVAL 4 DAY)
                             AND DATE_ADD(c.cohort_date, INTERVAL 7 DAY), 1, 0)) AS returned_d4_d7
  FROM cohorts c
  CROSS JOIN params p
  LEFT JOIN activity a
    ON c.resolved_user_id = a.resolved_user_id
   AND a.activity_date IN (
     DATE_ADD(c.cohort_date, INTERVAL 1 DAY),
     DATE_ADD(c.cohort_date, INTERVAL 4 DAY),
     DATE_ADD(c.cohort_date, INTERVAL 5 DAY),
     DATE_ADD(c.cohort_date, INTERVAL 6 DAY),
     DATE_ADD(c.cohort_date, INTERVAL 7 DAY)
   )
  WHERE c.cohort_date BETWEEN p.start_date AND p.end_date
  GROUP BY c.cohort_date, c.resolved_user_id
)

SELECT
  cohort_date,
  COUNT(*) AS cohort_size,
  SUM(returned_d1) AS retained_d1,
  SUM(returned_d4) AS retained_d4,
  SUM(returned_d7) AS retained_d7,
  SUM(returned_d4_d7) AS retained_d4_d7,
  SAFE_DIVIDE(SUM(returned_d1), COUNT(*)) AS d1_retention_rate,
  SAFE_DIVIDE(SUM(returned_d4), COUNT(*)) AS d4_retention_rate,
  SAFE_DIVIDE(SUM(returned_d7), COUNT(*)) AS d7_retention_rate,
  SAFE_DIVIDE(SUM(returned_d4_d7), COUNT(*)) AS d4_d7_retention_rate
FROM cohort_flags
WHERE DATE_ADD(cohort_date, INTERVAL 1 DAY) <= CURRENT_DATE()
GROUP BY cohort_date
ORDER BY cohort_date;
