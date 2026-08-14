-- =============================================================================
-- summary_daily_dau — pre-aggregated daily active users
-- Refresh: daily via scripts/refresh-summaries.js
-- Source: v_daily_active_users (one-time scan), dashboard reads this table only
-- =============================================================================

CREATE TABLE IF NOT EXISTS `{PROJECT}.{DATASET}.summary_daily_dau` (
  event_date    DATE    NOT NULL,
  platform      STRING,
  country       STRING,
  dau           INT64   NOT NULL,
  refreshed_at  TIMESTAMP NOT NULL
)
PARTITION BY event_date
CLUSTER BY platform, country;

-- Populate / refresh (MERGE last 90 days)
-- Run via refresh-summaries.js
