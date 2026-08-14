-- =============================================================================
-- v_new_users
-- First-seen date per user. Cohort anchor for retention.
--
-- Priority for new-user signal:
--   1. first_open (install)
--   2. first_open_android / first_open_ios (wrapper)
--   3. Registration event
--   4. Earliest event date (fallback)
-- Depends on: v_events_normalized
-- =============================================================================

CREATE OR REPLACE VIEW `{PROJECT}.{DATASET}.v_new_users` AS

WITH user_first_events AS (
  SELECT
    resolved_user_id,
    user_pseudo_id,

    MIN(event_date) AS first_event_date,

    MIN(CASE
      WHEN event_name_base IN ('first_open', 'first_open_android', 'first_open_ios')
        OR event_name IN ('first_open', 'first_open_android', 'first_open_ios')
      THEN event_date
    END) AS first_open_date,

    MIN(CASE
      WHEN event_name_base = 'Registration'
      THEN event_date
    END) AS registration_date,

    -- Dimensions at first touch
    ARRAY_AGG(
      STRUCT(platform, country, app_version, event_timestamp)
      ORDER BY event_timestamp ASC LIMIT 1
    )[OFFSET(0)] AS first_touch

  FROM `{PROJECT}.{DATASET}.v_events_normalized`
  WHERE resolved_user_id IS NOT NULL
  GROUP BY resolved_user_id, user_pseudo_id
)

SELECT
  resolved_user_id,
  user_pseudo_id,

  -- Cohort date: prefer install, then registration, then any first event
  COALESCE(first_open_date, registration_date, first_event_date) AS cohort_date,

  first_open_date,
  registration_date,
  first_event_date,

  CASE
    WHEN first_open_date IS NOT NULL THEN 'install'
    WHEN registration_date IS NOT NULL THEN 'registration'
    ELSE 'first_event'
  END AS cohort_type,

  first_touch.platform   AS first_platform,
  first_touch.country    AS first_country,
  first_touch.app_version AS first_app_version,
  first_touch.event_timestamp AS first_seen_at

FROM user_first_events;
