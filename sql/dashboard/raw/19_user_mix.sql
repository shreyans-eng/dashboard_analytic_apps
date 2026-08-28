-- =============================================================================
-- Unique vs new vs returning vs one-open vs repeat (same DAU events)
-- Qualifying: session_start, App_open, first_open (suffix-stripped)
-- Daily rows + range_* totals repeated on each row for KPI cards
-- =============================================================================

WITH base AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    {{resolved_user_id_cheap}} AS resolved_user_id,
    REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS event_name_base
  FROM `{PROJECT}.{DATASET}.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', {{start_date}})
                          AND FORMAT_DATE('%Y%m%d', {{end_date}})
    AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
    AND {{dau_event_predicate}}
    [[AND event_country = {{country}}]]
    [[AND event_platform = {{platform}}]]
),
per_user_day AS (
  SELECT
    event_date,
    resolved_user_id,
    COUNT(*) AS opens,
    COUNTIF(event_name_base = 'first_open') AS first_open_hits
  FROM base
  WHERE resolved_user_id IS NOT NULL
  GROUP BY event_date, resolved_user_id
),
daily AS (
  SELECT
    event_date,
    COUNT(*) AS unique_users,
    COUNTIF(first_open_hits > 0) AS new_users,
    COUNTIF(first_open_hits = 0) AS returning_users,
    COUNTIF(opens = 1) AS one_time_users,
    COUNTIF(opens >= 2) AS repeat_users,
    SUM(opens) AS opens,
    SAFE_DIVIDE(SUM(opens), COUNT(*)) AS opens_per_user,
    SAFE_DIVIDE(COUNTIF(first_open_hits = 0), COUNT(*)) AS returning_share,
    SAFE_DIVIDE(COUNTIF(opens >= 2), COUNT(*)) AS repeat_share
  FROM per_user_day
  GROUP BY event_date
),
per_user_range AS (
  SELECT
    resolved_user_id,
    SUM(opens) AS opens,
    SUM(first_open_hits) AS first_open_hits,
    COUNT(*) AS active_days
  FROM per_user_day
  GROUP BY resolved_user_id
),
rng AS (
  SELECT
    COUNT(*) AS range_unique_users,
    COUNTIF(first_open_hits > 0) AS range_new_users,
    COUNTIF(first_open_hits = 0) AS range_returning_users,
    COUNTIF(active_days = 1) AS range_one_day_users,
    COUNTIF(active_days >= 2) AS range_multi_day_users,
    SUM(opens) AS range_opens,
    SAFE_DIVIDE(SUM(opens), COUNT(*)) AS range_opens_per_user,
    SAFE_DIVIDE(COUNTIF(first_open_hits = 0), COUNT(*)) AS range_returning_share,
    SAFE_DIVIDE(COUNTIF(active_days >= 2), COUNT(*)) AS range_multi_day_share
  FROM per_user_range
)
SELECT
  d.event_date,
  d.unique_users,
  d.new_users,
  d.returning_users,
  d.one_time_users,
  d.repeat_users,
  d.opens,
  d.opens_per_user,
  d.returning_share,
  d.repeat_share,
  r.range_unique_users,
  r.range_new_users,
  r.range_returning_users,
  r.range_one_day_users,
  r.range_multi_day_users,
  r.range_opens,
  r.range_opens_per_user,
  r.range_returning_share,
  r.range_multi_day_share
FROM daily d
CROSS JOIN rng r
ORDER BY d.event_date;
