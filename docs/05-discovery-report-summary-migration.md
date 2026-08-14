# Discovery report — summary migration (verified)

Generated from live BigQuery inspection + repository inspection.  
**No fabricated numbers.** Banknote queries were **blocked** by IAM at discovery time.

---

## Banknote (`banknote-app-4f3fd` / `analytics_488476338`)

| Item | Result |
|------|--------|
| events_* table count | **BLOCKED** — SA lacks `bigquery.jobs.create` / `bigquery.tables.list` |
| earliest / latest date | **BLOCKED** |
| total raw rows / unique users / unique events | **BLOCKED** |
| `analytics_summary` tables | **BLOCKED** (could not list) |
| Config (repo) | `preferRaw=false`, `useSummary=true`, summary dataset `analytics_summary` |
| Existing KPI SQL | Views under `sql/0*.sql` + `sql/dashboard/product/*` + summary reads `sql/dashboard/summary/*` + scheduled materializers `sql/scheduled/*` |

### BLOCKED

```
Access Denied: Project banknote-app-4f3fd:
User does not have bigquery.jobs.create permission in project banknote-app-4f3fd.
```

Also: `bigquery.tables.list` denied on `analytics_488476338`.

### REQUIRED ACTION (Banknote)

Grant the Banknote dashboard service account on project `banknote-app-4f3fd`:

- `roles/bigquery.jobUser`
- `roles/bigquery.dataViewer` (raw + summary datasets)
- For refresh/create summaries: `roles/bigquery.dataEditor` on `analytics_summary` (and raw only if views are deployed)

Then re-run:

```bash
cd banknote-analytics-dashboard
PRODUCT=banknote npm run discover-events
PRODUCT=banknote npm run refresh-summaries:product
```

---

## Coinzy (`coinzy-26a4d` / `analytics_487601380`) — verified

| Item | Value |
|------|--------|
| events_* tables (daily, non-intraday) | **417** |
| earliest table/date | **2025-06-21** |
| latest table/date | **2026-08-11** |
| missing calendar days in range | **0** |
| sum of table `row_count` / full-scan total events | **14,191,134** |
| unique users (all-time) | **213,890** |
| unique event names (all-time) | **284** |
| last-30d events | 915,604 |
| last-30d unique event names | 247 |
| last-30d unique users | 14,103 |
| `analytics_summary` before migration | **did not exist** |
| `analytics_summary` create | **SUCCEEDED** (dataset created during discovery) |
| CREATE TABLE permission | **SUCCEEDED** (probe create/drop) |

### Top events (last 30 days of data ending 2026-08-11)

| event_name | count | users |
|------------|------:|------:|
| screen_view | 177,640 | 11,044 |
| notification_display | 64,935 | 10,772 |
| user_engagement | 35,636 | 10,610 |
| login | 31,174 | 8,080 |
| Homescreen | 26,589 | 5,691 |
| Photo_clicked | 20,625 | 3,858 |
| … | (247 names in window) | |

Full inventory is refreshable via `npm run discover-events` (writes JSON under `analytics-inventory/`, gitignored).

### KPI-relevant events present in Coinzy (all-time, verified)

| event_name | count | users | notes |
|------------|------:|------:|-------|
| Collection_screen | 970,494 | 56,887 | **Not** in preferred catalogue aliases (`Collection_open`) — see ambiguities |
| App_open_android | 557,603 | 169,457 | DAU / open |
| Identify_bottom_nav | 392,740 | 97,458 | Identify entry; not in preferred `Identify_open` list |
| Identification_screen | 369,691 | 99,357 | Identify entry |
| Subs_page | 325,354 | 71,943 | Paywall |
| first_open | 151,652 | 151,364 | Install / cohort |
| Identify_home | 125,455 | 57,231 | Identify entry |
| Identification_done | 110,385 | 46,781 | Submit / attempt |
| Subs_page_discount | 103,871 | 58,623 | Paywall |
| Global_catalogue_screen | 88,363 | 41,911 | Catalogue-like |
| Identified_limit_reached | 36,497 | 32,422 | Quota |
| identification_done_success | 18,353 | 10,058 | Success (from 2026-02-25) |
| identification_done_failure | 17,041 | 6,995 | Failure (from 2026-02-25) |
| marketplace_bottom_nav | 15,460 | 7,784 | Marketplace entry |
| Identification_failed | 58,259 | 26,465 | **Ambiguous** vs `identification_done_failure` |

### KPI events **missing** or weak on Coinzy

| Expected (docs / existing SQL) | Coinzy status |
|--------------------------------|---------------|
| `Subs_confirm` | **Not found** in alias presence query → paid users / confirm rate stay ~0 until instrumented |
| `Identify_open` | **Not found**; Coinzy uses `Identify_bottom_nav` / `Identification_screen` / `Identify_home` |
| `Collection_open` | **Not found**; Coinzy uses `Collection_screen` / `collection_bottom_nav` |
| `Marketplace_open` | **Not found**; Coinzy uses `marketplace_bottom_nav` / `Feed_screen` / `market_item_expolre` |

---

## Ambiguous KPI mappings (not silently guessed)

1. **Identify open (funnel):** Preferred `Identify_open` absent; high-volume Coinzy events `Identify_bottom_nav`, `Identification_screen`, `Identify_home` — need product confirmation before treating as open.
2. **Catalogue:** Preferred `Collection_open` absent; `Collection_screen` / `Global_catalogue_screen` are likely equivalents — not auto-mapped in production SQL until confirmed.
3. **Failure:** `Identification_failed` vs `identification_done_failure` — both exist; only documented failure names are used in KPI SQL.
4. **Purchase:** `Subs_confirm` absent → paywall conversion / paid users cannot be validated from confirms.
5. **User’s section-9 list** (MAU, Revenue, Paid Users as separate KPIs) vs **repo’s authoritative 10 MVP tabs** — implementation follows **repo docs** (`01-concise-mvp-overview.md`): DAU, time-to-first-scan, identify success, quota, paywall, D1/D7, scans/user, funnel, catalogue, marketplace. Explorer still has MAU/new users/countries/platform/events.

---

## Code events vs BigQuery

No dedicated JS event-constant module exists in this repo. Event names live in SQL + docs.

| Category | Finding |
|----------|---------|
| Documented + present in Coinzy BQ | `first_open`, `identification_done_success/failure`, `Identified_limit_reached`, `Subs_page`, `Subs_page_discount`, … |
| Documented + missing in Coinzy BQ | `Subs_confirm`, `Identify_open`, `Collection_open`, `Marketplace_open` |
| Present in Coinzy BQ + no preferred doc name | Hundreds of UI events (`screen_view`, onboarding_*, Photo_clicked, …) — inventory only, not KPI tables |

Banknote code-vs-BQ comparison: **BLOCKED** (no job permission).

---

## Proposed / reused summary tables (grain)

Reuse Banknote scheduled design in each product’s `analytics_summary`:

| Table | Grain | Source |
|-------|-------|--------|
| `daily_active_users` | date × platform × country | raw `events_*` |
| `monthly_active_users` | month × platform × country | raw |
| `daily_new_users` | cohort_date × platform × country | raw (`first_open` / first seen) |
| `daily_retention` | cohort_date × platform × country | raw |
| `country_metrics` | date × country | raw |
| `platform_metrics` | date × platform | raw |
| `top_events` | date × event_name_base | raw |
| `product_daily_signals` | date | raw (MVP / Compare common KPI layer) |
| `event_inventory_daily` | date × event_name | discovery refresh (optional inventory, not dashboard KPI) |

Do **not** create one summary table per Firebase event.

---

## Fallback order (target)

`summary` → existing view → raw SQL → clear error  

Retention: combined summary → merge D1+D7 (view/raw) → error (never fake zeros).
