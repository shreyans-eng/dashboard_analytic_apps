# BigQuery Analytics Layer — Coinzy / Banknote AI

**Generated:** 2026-08-06  
**Scope:** Firebase Analytics → BigQuery production views and metric queries  
**App code unchanged** — SQL and documentation only.

---

## Prerequisites

### 1. Replace placeholders

Throughout this document, replace:

| Placeholder | Example |
|-------------|---------|
| `{PROJECT}` | `coinzy-prod` |
| `{DATASET}` | `analytics_123456789` |
| `{START_DATE}` | `2025-01-01` (optional filter for backfills) |

Full table reference: `` `{PROJECT}.{DATASET}.events_*` ``

### 2. GA4 export tables

Firebase exports daily shards:

- `events_YYYYMMDD` — daily batch
- `events_intraday_YYYYMMDD` — streaming (same schema)

Views below use `events_*` wildcard. For intraday-only dashboards, swap to `events_intraday_*`.

### 3. Identity model

Priority for `resolved_user_id`:

1. GA4 `user_id` column (after app calls `setUserId`)
2. Event param `user_id` (wrapper common param)
3. `user_pseudo_id` (device fallback)

### 4. Platform model

Priority for `platform`:

1. Event param `platform`
2. Parsed from event name suffix (`_android` / `_ios`)
3. `device.operating_system`

### 5. Event name normalization

Wrapper events log as `{base_event}_android` or `{base_event}_ios`.  
`v_events_normalized` strips the suffix into `event_name_base`.

Direct events (no suffix): `subscription`, `life_time_access`, `rating feedback`, `install_*`.

---

## Deployment order

Run scripts in this order (each depends on the previous):

```
sql/01_v_events_normalized.sql
sql/02_v_daily_active_users.sql
sql/03_v_monthly_active_users.sql
sql/04_v_new_users.sql
sql/05_v_country_metrics.sql
sql/06_v_retention_cohorts.sql
sql/07_v_subscription_metrics.sql
```

Then use queries in `sql/queries/` or the **Metric Queries** section below for Metabase.

---

## View summaries

| View | Grain | Purpose |
|------|-------|---------|
| `v_events_normalized` | Event | Clean event stream with flat params |
| `v_daily_active_users` | User × day | DAU building block |
| `v_monthly_active_users` | User × month | MAU building block |
| `v_new_users` | User | First-seen date per user |
| `v_country_metrics` | Country × day | Geo KPIs |
| `v_retention_cohorts` | Cohort × period | D1/D7/D30 retention |
| `v_subscription_metrics` | Day | Monetization funnel |

---

## Metric Queries (for Metabase cards)

See `sql/queries/` for standalone files with Metabase variable syntax (`{{start_date}}`, `[[AND ...]]`).

| Metric | View / table | Query file |
|--------|--------------|------------|
| DAU | `v_daily_active_users` | `sql/queries/dau.sql` |
| WAU | `v_daily_active_users` (7-day rolling) | `sql/queries/wau.sql` |
| MAU | `v_daily_active_users` | `sql/queries/mau.sql` |
| New Users | `v_new_users` | `sql/queries/new_users.sql` |
| D1 Retention | `v_retention_cohorts` | `sql/queries/d1_retention.sql` |
| D7 Retention | `v_retention_cohorts` | `sql/queries/d7_retention.sql` |
| Top Countries | `v_daily_active_users` | `sql/queries/top_countries.sql` |
| Top Events | `v_events_normalized` | `sql/queries/top_events.sql` |
| App Version Distribution | `v_events_normalized` | `sql/queries/app_version_distribution.sql` |

### Deploy all views

```bash
chmod +x deploy-views.sh
PROJECT=your-gcp-project DATASET=analytics_XXXXXXXXX ./deploy-views.sh
```

Or run each file manually in BigQuery Console after replacing `{PROJECT}` and `{DATASET}`.

---

## Maintenance

- **Daily:** Views auto-refresh (no materialization). For large datasets, consider scheduled materialized tables.
- **Weekly:** Spot-check `first_open` vs `v_new_users` counts against Firebase console.
- **On new events:** No view change needed; they flow through `v_events_normalized` automatically.
- **Cost:** Partition prune with `event_date` filters in every Metabase question.

---

## Related files

| File | Contents |
|------|----------|
| `sql/01_v_events_normalized.sql` | Base normalized event view |
| `sql/02_v_daily_active_users.sql` | DAU grain |
| `sql/03_v_monthly_active_users.sql` | MAU grain |
| `sql/04_v_new_users.sql` | New user registry |
| `sql/05_v_country_metrics.sql` | Country daily metrics |
| `sql/06_v_retention_cohorts.sql` | Retention cohorts |
| `sql/07_v_subscription_metrics.sql` | Subscription KPIs |
| `sql/queries/*.sql` | Ad-hoc metric queries |
| `analytics-dashboard-plan.md` | Metabase dashboard spec |
