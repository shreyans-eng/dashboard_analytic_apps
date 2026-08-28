# Banknote Analytics — end-to-end project flow

**Canonical architecture for this repo.** Read this first; other docs go deeper on KPIs, SQL, cost, or deploy.

| Apps | Stack |
|------|--------|
| **Banknote** · **Coinzy** (strictly separate) | Firebase → BigQuery → (summaries / Mongo LTV) → Node API → React |

Related: [ANALYTICS-DOCS.md](./ANALYTICS-DOCS.md) (index) · [07 tabs & formulas](./07-dashboard-tabs-and-calculations.md) · [09 LTV rules](./09-cohort-ltv.md) · [deploy](./deploy.md)

---

## 1. One-page picture

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  Mobile apps                                                             │
│  Banknote & Coinzy → Firebase Analytics (GA4 events)                     │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ daily BigQuery export (Google)
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Google Cloud BigQuery — SOURCE OF TRUTH (read-only for us)              │
│                                                                          │
│  Banknote: banknote-app-4f3fd.analytics_488476338.events_*               │
│  Coinzy:   coinzy-26a4d.analytics_487601380.events_*                     │
│                                                                          │
│  Never mutate events_*. Never invent pack prices.                        │
└───────┬────────────────────────────────────────────┬─────────────────────┘
        │                                            │
        │ once / day                                 │ once / day
        │ refresh-summaries:product                  │ refresh-ltv:mongo
        │ (optional; other KPIs)                     │ (Cohort LTV)
        ▼                                            ▼
┌───────────────────────────┐          ┌───────────────────────────────────┐
│ BigQuery analytics_summary│          │ MongoDB (existing cluster)        │
│ DAU, retention, signals…  │          │ • users / auth / access           │
│ (if dataset + IAM exist)  │          │ • cohort_ltv  ← aggregated LTV    │
└─────────────┬─────────────┘          └─────────────────┬─────────────────┘
              │                                          │
              └──────────────────┬───────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Node API  (banknote-analytics-dashboard/server)                         │
│  • Product facade: Banknote | Coinzy | Compare                           │
│  • Prefer cheap stores → raw BQ only as fallback / emergency             │
│  • App cache: memory or Redis (~24h for most metrics)                    │
└───────────────────────────────┬──────────────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  React dashboard                                                         │
│  Home · MVP KPIs · Explorer (DAU, retention, …) · Cohort LTV ·           │
│  Funnels · Compare · Admin                                               │
└──────────────────────────────────────────────────────────────────────────┘
```

**Cost idea:** pay for BigQuery **once per day** (refresh jobs). Users click the dashboard all day against **summary tables** or **MongoDB**, not against raw `events_*`.

---

## 2. Products & credentials (never mix)

| | Banknote | Coinzy |
|--|----------|--------|
| GCP project | `banknote-app-4f3fd` | `coinzy-26a4d` |
| Raw dataset | `analytics_488476338` | `analytics_487601380` |
| Summary dataset (optional KPIs) | `analytics_summary` | `analytics_summary` |
| Service account | `metabase-local-dev@…` (GCP SA name; used by **this dashboard**, not Metabase) | `analytics-dashboard-coinzy@…` |
| Creds env | `GOOGLE_APPLICATION_CREDENTIALS` | `COINZY_GOOGLE_APPLICATION_CREDENTIALS` |
| Mongo LTV `product` field | `banknote` | `coinzy` |

Compare mode = fan-out both products, tag rows with product label, **never** union raw tables in one query.

---

## 3. Where data lives

| Store | Contents | Written by | Read by |
|-------|----------|------------|---------|
| **Firebase** | Live app events | Mobile apps | Export to BQ only |
| **BigQuery `events_*`** | Daily shards (source of truth) | Firebase export | Refresh jobs; rare raw API fallbacks |
| **BigQuery `analytics_summary.*`** | DAU, MAU, retention, `product_daily_signals`, … | `npm run refresh-summaries:product` | Explorer / MVP / Compare (when available) |
| **MongoDB `users`** | Login, roles, page access | Admin / seed | Auth middleware |
| **MongoDB `cohort_ltv`** | Aggregated LTV-30/90/180 by cohort × country × channel × platform | `npm run refresh-ltv:mongo` | Explorer LTV + Compare LTV |
| **Redis / memory cache** | Cached API JSON for identical filters | API after a store hit | Repeat identical requests |
| **React Query** | Browser stale cache | Client | Same tab session |

### What we do *not* do

- Do not write analytics into Firebase.
- Do not create BigQuery tables inside Firebase export datasets for LTV.
- Do not require `analytics_summary` for Cohort LTV (LTV uses Mongo).
- Do not mix Banknote and Coinzy rows without a `product` discriminator.

---

## 4. Two daily jobs (ops)

Run **after** Firebase daily export lands (often ~08:00–10:00 UTC).

### A. KPI summaries (optional but recommended for DAU / Compare signals)

```bash
cd banknote-analytics-dashboard
PRODUCTS=banknote,coinzy DAYS=90 npm run refresh-summaries:product
```

- Reads `events_*`
- Writes `{project}.analytics_summary.*` (needs that dataset + Data Editor)
- Used by many Explorer / MVP / Compare signal tabs

### B. Cohort LTV → MongoDB (required for cheap LTV)

```bash
PRODUCTS=banknote,coinzy DAYS=30 LTV_DAYS=210 npm run refresh-ltv:mongo
```

- **Read-only** BigQuery `SELECT` (`sql/scheduled/cohort_ltv_mongo.sql`)
- Window: cohort lookback `LTV_DAYS` (default 210) through latest day; purchase scan up to +180 days
- Idempotent: delete Mongo docs for that product + date window, then insert
- No BigQuery DDL; no `analytics_summary` for LTV

Schedule both on cron / Render cron in production.

---

## 5. Request flows (what happens when a user clicks)

### 5.1 Typical Explorer metric (e.g. DAU)

```text
UI → API → app cache?
         → else try analytics_summary → else view → else raw events_*
         → cache result → JSON { rows, source, bytesProcessed }
```

`source` is usually `summary` | `view` | `raw`.

### 5.2 Cohort LTV (Explorer `/ltv`)

```text
UI (filters + page/page_size/search)
  → API ltv
  → app cache?
  → MongoDB cohort_ltv  (filter by product, dates, country, channel, platform)
  → roll up platform, paginate table rows
  → also return daily / by_channel / totals for charts
  → source: "mongodb", bytesProcessed: 0
```

**Normal path does not call BigQuery.**

Emergency only:

| Flag | Behavior |
|------|----------|
| `LTV_FORCE_RAW=true` | Always scan `events_*` (debug) |
| `LTV_ALLOW_RAW_FALLBACK=true` | If Mongo has **zero** docs for that product, allow one raw scan |

Default: both off → clear error if Mongo empty (“run refresh-ltv:mongo”).

### 5.3 Compare

```text
Compare page
  → product_daily_signals per app (summary/raw)  +  compare-ltv
  → compare-ltv fans out Banknote + Coinzy Mongo LTV (paginate=false)
  → source: "mongodb" when both served from Mongo
```

### 5.4 Funnels / event detail

Often still hit BigQuery (lean columns, cached). Prefer short date ranges. See [08-bigquery-cost.md](./08-bigquery-cost.md).

---

## 6. Cohort LTV business rules (short)

| Rule | Detail |
|------|--------|
| Formula | Revenue in N days after install ÷ cohort installs |
| Windows | LTV-30 / 90 / 180 (days 0–29 / 0–89 / 0–179) |
| Immature | NULL / `—` (not partial) |
| Cohort | First `first_open` per user |
| Channel | Organic / Paid / Direct frozen on that first open |
| Revenue | `in_app_purchase` / `purchase` USD only — not `Subs_confirm` |
| Date filter | Install (cohort) dates, not calendar purchase dates |
| Grain in Mongo | `product × cohort_date × country × install_channel × platform` |
| API grain | Platform rolled up unless filtered |

Full rules: [09-cohort-ltv.md](./09-cohort-ltv.md) · flow: [10-cohort-ltv-full-flow.md](./10-cohort-ltv-full-flow.md)

---

## 7. Repo map

```text
bigdata/
  docs/                          ← you are here (00 = this file)
  sql/
    scheduled/                   ← materialize summaries; cohort_ltv_mongo.sql (SELECT)
    dashboard/summary/           ← cheap BQ reads
    dashboard/raw/               ← expensive fallbacks (incl. LTV emergency)
    dashboard/product/           ← product-shaped views
  banknote-analytics-dashboard/
    scripts/
      refresh-product-summaries.js   ← BQ → analytics_summary
      refresh-cohort-ltv-mongo.js    ← BQ → Mongo cohort_ltv
    server/
      db.js                          ← Mongo connection
      cache/                         ← memory + Redis
      services/analytics/
        product-registry.js          ← multi-product facade, compare
        analytics-repository.js      ← summary/raw + _runLtv → Mongo
        cohort-ltv-mongo.js          ← collection, indexes, query + pagination
        bigquery-client.js           ← jobs, byte cap
    src/                             ← React UI (LtvPage, ComparePage, …)
    .env                             ← projects, SA paths, MONGODB_URI
```

---

## 8. Environment checklist

```bash
# BigQuery
GCP_PROJECT=banknote-app-4f3fd
BQ_DATASET=analytics_488476338
GOOGLE_APPLICATION_CREDENTIALS=../secrets/...
COINZY_GCP_PROJECT=coinzy-26a4d
COINZY_BQ_DATASET=analytics_487601380
COINZY_GOOGLE_APPLICATION_CREDENTIALS=../secrets/...
USE_SUMMARY_TABLES=true
COINZY_USE_SUMMARY_TABLES=true
COINZY_PREFER_RAW=false

# Mongo (auth + LTV)
MONGODB_URI=mongodb+srv://...
MONGODB_DB=analytics_dashboard

# LTV safety
# LTV_FORCE_RAW=false
# LTV_ALLOW_RAW_FALLBACK=false
# LTV_DAYS=210

# Optional
# REDIS_URL=...
# BQ_MAX_BYTES_BILLED=21474836480
```

---

## 9. How to verify the system is healthy

| Check | Healthy signal |
|-------|----------------|
| LTV refresh | Script prints MB scanned once; Mongo counts grow; re-run deletes+inserts same window (no dupes) |
| Explorer LTV | UI/API `source: mongodb`, `bytesProcessed: 0` |
| Compare LTV | `source: mongodb`, both products listed under `sources` |
| Filter change | Still Mongo — no new BigQuery LTV jobs in GCP |
| DAU / Compare signals | Prefer `source: summary` after summary refresh |
| Auth | Login works via Mongo `users` |

---

## 10. Cost model (order of magnitude)

| Action | Who pays BQ? |
|--------|----------------|
| Daily LTV Mongo refresh × 2 apps | **Yes** — once (often ~0.8–2.5 GB each in recent runs) |
| Daily summary refresh | **Yes** — once per window |
| User opens LTV / changes country/channel/page | **No** (Mongo + optional Redis) |
| User opens DAU with summary present | Tiny summary scan |
| User opens funnel / SQL editor / raw fallback | Can be GB — keep ranges short |

Details: [08-bigquery-cost.md](./08-bigquery-cost.md)

---

## 11. Local / production commands

```bash
cd banknote-analytics-dashboard

# App
npm run dev          # API + Vite

# Daily jobs
PRODUCTS=banknote,coinzy DAYS=90 npm run refresh-summaries:product
PRODUCTS=banknote,coinzy DAYS=30 LTV_DAYS=210 npm run refresh-ltv:mongo

# Build
npm run build
```

Deploy notes: [deploy.md](./deploy.md)

---

## 12. Mental model (one sentence)

**Firebase collects events into BigQuery; we precompute expensive aggregates once a day into either `analytics_summary` (general KPIs) or MongoDB `cohort_ltv` (LTV); the dashboard API serves those stores with filters and cache so interactive use does not re-scan raw `events_*`.**
