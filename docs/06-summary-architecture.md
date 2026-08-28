# Analytics architecture — raw → discovery → summary → dashboard

## Target flow

```
Firebase daily export
        ↓
BigQuery raw events_YYYYMMDD   ← SOURCE OF TRUTH (never mutate)
        ↓
Automatic event discovery      (inventory JSON / optional event_inventory_daily)
        ↓
KPI mapping (docs + existing SQL only — no name guessing)
        ↓
analytics_summary tables       ← production dashboard layer
        ↓
Custom dashboard (Banknote | Coinzy | Compare)
        ↓ fallback if summary missing
Views (v_*) → raw SQL → clear error
```

## Products

| Product | Project | Raw dataset | Summary dataset | preferRaw | useSummary |
|---------|---------|-------------|-----------------|-----------|------------|
| Banknote | `banknote-app-4f3fd` | `analytics_488476338` | `analytics_summary` | false | true |
| Coinzy | `coinzy-26a4d` | `analytics_487601380` | `analytics_summary` | false | true |

## Summary tables (grain)

| Table | Grain | Used by |
|-------|-------|---------|
| `daily_active_users` | date × platform × country | Explorer DAU |
| `monthly_active_users` | month × platform × country | Explorer MAU |
| `daily_new_users` | cohort_date × platform × country | New users |
| `daily_retention` | cohort_date × platform × country | D1/D7 |
| `country_metrics` | date × country | Countries |
| `platform_metrics` | date × platform | Platform |
| `top_events` | date × event_name_base × … | Top events |
| `product_daily_signals` | date | MVP KPIs + Compare |
| `event_inventory_daily` | date × event_name | Discovery only (optional) |

> **Cohort LTV:** daily BigQuery SELECT → MongoDB `cohort_ltv` (not `analytics_summary`, no BQ write). API serves Mongo with filters/pagination. See [09-cohort-ltv.md](./09-cohort-ltv.md).

SQL builders: `sql/scheduled/*.sql`  
Dashboard readers: `sql/dashboard/summary/*.sql`  
Raw fallbacks: `sql/dashboard/raw/*.sql`  
LTV refresh SELECT: `sql/scheduled/cohort_ltv_mongo.sql`  
View path: `sql/dashboard/*.sql` + `sql/dashboard/product/*.sql`

## KPI mappings

Authoritative definitions: `docs/01-concise-mvp-overview.md`, `docs/03-full-queries-and-events.md`.  
Verified discovery + ambiguities: `docs/05-discovery-report-summary-migration.md`.

Common KPI layer for Compare = `product_daily_signals` (same schema both products).  
Raw event names may differ by product; mappings live in SQL, not the React UI.

## Fallback

1. Summary table  
2. Existing BigQuery view  
3. Raw `events_*` SQL  
4. Clear error (never fake zeros)

Retention: summary `daily_retention` → merge D1+D7 view/raw paths → error.

API responses include `source: summary | view | raw` when queries run through the repository.

## Cache

| Metric class | TTL |
|--------------|-----|
| Daily / most KPIs | 24h |
| Top events | 1h |
| Status | 5m |
| Intraday | disabled |

## Freshness

- Raw: Firebase → BigQuery **daily** export (not real-time). There are currently **no** `events_intraday_*` tables.
- Latest **complete** DAU day = `MAX(events_YYYYMMDD)` in the dataset. The dashboard omits later dates instead of showing 0.
- Summary: refreshed by `npm run refresh-summaries:product` (run after export lands, e.g. ~08:00–10:00 UTC).
- Cache: may serve summary results up to TTL after refresh.

## DAU (three series)

Do not mix notification users into app-open DAU. `dau` on the dashboard is always **app-open**.

| Field | Meaning | Events (suffix `_android` / `_ios` stripped) |
|-------|---------|-----------------------------------------------|
| `app_open_dau` / `dau` | Opened the app or started a session | `session_start`, `App_open`, `first_open` |
| `notification_dau` | Received / displayed / tapped a push | `notification_display`, `notification_receive`, `notification_foreground`, `notification_open`, `notification_opened`, `notification_dismiss`, `notification_interact` |
| `any_event_dau` | Any Firebase activity that day | any event in `events_*` |

Not in `notification_dau`: in-app permission / onboarding (`Notification_permission_*`, `onboarding_notification_permission*`) and in-app `notif_popup` / `notif_popup_android` / `notif_popup_ios`. Those are app UX, not push delivery.

Computed from raw `events_*` on every summary refresh — never copied from an older `dau` value. Shared predicates: `banknote-analytics-dashboard/server/services/analytics/dau-definition.js`.

`product_daily_signals` is **date-only**. Unfiltered Explorer/MVP/Compare DAU can read it after refresh. Country or platform filters skip that table and query `events_*` so the filter actually changes the number.

Identity: skip placeholder `user_id` values (`anonymous`, empty, `(not set)`); otherwise GA4 `user_id` → event param `user_id` → `user_pseudo_id`.

Flow: Firebase `events_*` → `sql/scheduled/product_daily_signals.sql` → `analytics_summary.product_daily_signals` → API `getProductDailySignals` / `compare-daily` → Compare UI (`Opened the app (DAU)` vs `Notification (display / receive)`).

## Commands

```bash
cd banknote-analytics-dashboard

# Discover complete event inventory (writes analytics-inventory/*.json)
PRODUCT=coinzy npm run discover-events
PRODUCT=coinzy FULL=1 npm run discover-events   # all-time (more $)

# Refresh summaries (discovers date bounds; default window = DAYS or full range)
PRODUCT=coinzy DAYS=90 npm run refresh-summaries:product
PRODUCT=coinzy START=2025-06-21 END=2026-08-11 npm run refresh-summaries:product
PRODUCT=banknote DAYS=90 npm run refresh-summaries:product

# Optional inventory table materialization
PRODUCT=coinzy DAYS=30 INCLUDE_INVENTORY=1 npm run refresh-summaries:product

# Validate summary DAU vs raw
PRODUCT=coinzy DAYS=7 npm run validate:summary

# Dashboard
npm run dev   # http://localhost:5173
```

## IAM

| Role | Why |
|------|-----|
| `bigquery.jobUser` (project) | Run queries |
| `bigquery.dataViewer` (raw + summary) | Read |
| `bigquery.dataEditor` (summary dataset) | Create/refresh summary tables |
| Optional `dataEditor` on raw | Only if deploying views into raw dataset |

## Adding a KPI

1. Confirm events in inventory (`discover-events`).  
2. Add mapping only from docs/product confirmation.  
3. Extend `product_daily_signals` (or a dedicated summary table) — do not create one table per event.  
4. Wire dashboard/summary + raw fallback.  
5. Validate summary vs raw.

## Adding a product

See `docs/02-concise-add-app.md`. After `.env` registration, run discover + refresh for that product.
