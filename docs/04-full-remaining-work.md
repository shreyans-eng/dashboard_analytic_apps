# Analytics — Full guide: what’s left so everything works

Status as of Aug 2026. Use this as the action checklist until all 10 MVP tabs are complete for every app (views + events + data).

---

## 1. Current state (honest)

| Area | Banknote | Coinzy |
|------|----------|--------|
| Explorer tabs (DAU/MAU/countries/…) | Working (summary → view → raw) | **Summary preferred** (30d refreshed Aug 13 2026); raw fallback remains |
| Compare | Working | Working via `product_daily_signals` summary when present |
| Multi-app switcher | Working | Working |
| MVP tabs 1,3–10 | Signal/summary path | **Summary `product_daily_signals`** (+ raw fallback) |
| MVP 2 Time to first scan | Still empty without views | Still empty (ambiguous / no summary yet) |
| Product views (`v_*`) | Need deploy (IAM may block) | Need Data Editor on raw dataset to deploy views |
| Summary tables | **BLOCKED** refresh (SA missing Job User) | **Created** in `analytics_summary` (30-day window) |

Dashboard still shows numbers for most MVP cards because it falls back to `sql/dashboard/raw/16_product_daily_signals.sql`. Full funnel / median time-to-scan / add-after-ID need **views + correct events**.

---

## 2. Must-do for Banknote (product views)

**Goal:** Stop “view missing, falling back” and enable MVP 2 + richer funnel columns.

```bash
export GCP_PROJECT=banknote-app-4f3fd
export BQ_DATASET=analytics_488476338
export GOOGLE_APPLICATION_CREDENTIALS=secrets/bigquery-banknote-sa.json

# Product metric views (identify, engagement, subs, time-to-first-scan, kpi daily)
./scripts/deploy-product-metrics.sh

# Or full stack including DAU/retention base views
./scripts/deploy-product-views.sh
```

**Verify in BigQuery:**

- `v_events_normalized`
- `v_identify_metrics`
- `v_engagement_metrics`
- `v_subscription_metrics`
- `v_time_to_first_scan`
- `v_product_kpi_daily`
- `v_retention_cohorts`

**Then:** restart dashboard; open MVP 2–10 on Banknote — should hit `sql/dashboard/product/0X_*.sql` (no fallback warn).

Optional later: build/refresh `analytics_summary` tables for cheaper explorer queries.

---

## 3. Must-do for Coinzy

### 3a. IAM

Coinzy SA is **Data Viewer only** today → cannot `CREATE VIEW`.

- Grant **BigQuery Data Editor** (dataset) to the Coinzy dashboard SA, **or**
- Keep raw forever (`COINZY_PREFER_RAW=true`) — MVP 2 still needs a raw SQL added (see 3c).

### 3b. After Data Editor

```bash
GCP_PROJECT=coinzy-26a4d \
BQ_DATASET=analytics_487601380 \
GOOGLE_APPLICATION_CREDENTIALS=secrets/coinzy-analytics-dashboard-sa.json \
  ./scripts/deploy-product-views.sh
```

Then in `.env`:

```bash
COINZY_PREFER_RAW=false
# or PRODUCT_COINZY_PREFER_RAW=false
```

### 3c. Firebase → BigQuery export

Confirm **all** Coinzy apps that should appear are linked to BigQuery export (only some may be exporting today).

### 3d. Raw time-to-first-scan

Done. `sql/dashboard/raw/02_time_to_first_scan.sql` plus per-app `product/{banknote,coinzy}/02_time_to_first_scan.sql`. Join is `user_pseudo_id` on the same calendar day (not `COALESCE(user_id, …)`). `getMvpMetric` falls back to the raw file if product SQL is missing.

---

## 4. Must-do in both apps (instrumentation)

If rates are ~0, events are missing or renamed. Ship **preferred** names (suffix `_android`/`_ios` OK):

| Priority | Events |
|----------|--------|
| P0 | `first_open` |
| P0 | `Identify_open` → … → `identification_done_success` / `identification_done_failure` |
| P0 | `Identified_limit_reached` (or `scan_quota_exhausted`) |
| P0 | `Subs_page` / `Subs_page_discount` → `Subs_confirm` |
| P1 | `Collection_open`, `banknote_detail` / `coin_detail`, `Added_to_collection*` + entity id |
| P1 | `Marketplace_open` / `Listing_view`, `contact_seller` |
| P2 | Camera permission, photo_captured, identification_submit (full funnel) |
| P2 | Onboarding start/complete, UTM on install |

Params: `user_id`, `country`, `platform`, `banknote_id` **or** `coin_id`.

Full alias list: `docs/03-full-queries-and-events.md`.

---

## 5. Dashboard / engineering leftovers

| Item | Status | Action |
|------|--------|--------|
| Multi-app registry (`PRODUCTS=`) | Done | — |
| 10 MVP sidebar tabs | Done | — |
| Compare N apps | Done | — |
| Country dropdown filter | Done | — |
| Raw MAU / D1 / D7 | Done | — |
| MVP 2 raw fallback | **Open** | Add raw SQL + map in `MVP_KPI_MAP` |
| Banknote product views deployed | **Open** | Run deploy script |
| Coinzy views + `PREFER_RAW=false` | **Open** | IAM + deploy |
| Summary table refresh jobs | Optional | Cost optimization |
| `v_product_kpi_daily` overview card UI | Optional | Wire `00_mvp_overview_kpis.sql` to a page |
| Per-app `PRODUCT_CATALOG` for new brands | As needed | `src/lib/product.tsx` |

---

## 6. Definition of “everything works”

Check off when true for **each** registered app:

- [ ] Sidebar switcher selects the app; all explorer tabs load
- [ ] All **10 MVP tabs** return rows (including time to first scan)
- [ ] No repeated “view missing / falling back” for that app (or raw path intentional)
- [ ] Compare shows the app with non-null core rates where events exist
- [ ] Country + platform filters change the series
- [ ] Identify success / funnel / catalogue / marketplace move when QA fires the preferred events
- [ ] Docs match shipped events (`03`) and this checklist is green

---

## 7. Suggested order of work

1. **Instrument** P0 events on Banknote + Coinzy (if not already).
2. **Deploy Banknote** product views (`deploy-product-metrics.sh`).
3. **Grant Coinzy** Data Editor → deploy views → `PREFER_RAW=false`.
4. **QA** same-day first ID on MVP 2 / Health report (device join; 1–26 Aug ~24% Banknote, ~20% Coinzy).
5. **QA** each MVP tab per app + Compare.
6. (Optional) Summary tables + overview KPI page.

---

## 8. Quick commands

```bash
# Dashboard
cd banknote-analytics-dashboard && npm run dev

# Banknote views
./scripts/deploy-product-metrics.sh

# Coinzy views (needs Data Editor)
GCP_PROJECT=coinzy-26a4d BQ_DATASET=analytics_487601380 \
  GOOGLE_APPLICATION_CREDENTIALS=secrets/coinzy-analytics-dashboard-sa.json \
  ./scripts/deploy-product-views.sh
```

---

*Concise docs: `01-concise-mvp-overview.md`, `02-concise-add-app.md` · Query/event detail: `03-full-queries-and-events.md`*
