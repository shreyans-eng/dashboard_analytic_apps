# Product Analytics — Banknote & Coinzy

**This is the only project document.** Architecture, tabs, formulas, events, cost, deploy, and how to add an app live here.

Firebase collects events → BigQuery is the source of truth → we precompute expensive aggregates once a day (`analytics_summary` for KPIs, MongoDB `cohort_ltv` for LTV) → the Node API serves those stores with cache so dashboard clicks do not re-scan raw `events_*`.

---

## 1. What this is

Custom dashboard for **Banknote** (paper money ID) and **Coinzy** (coins). Same 10 MVP KPIs, strictly separate BigQuery projects — never unioned in one query.

| | Stack |
|--|--------|
| UI | Vite + React 18 + TanStack Query + Recharts (`localhost:5173`) |
| API | Express (`localhost:3001`) |
| Data | BigQuery `events_*` · `analytics_summary` · MongoDB (auth + LTV) |
| Cache | Memory or Redis (~24h) + React Query in the browser |

Journey both apps share: `Acquire → Onboard → Identify → Trust → Collect → Limit → Pro → Return`

---

## 2. Architecture

```text
Mobile apps (Banknote, Coinzy)
        │ Firebase Analytics (GA4)
        ▼ daily export (Google)
BigQuery events_*          ← SOURCE OF TRUTH (never mutate)
        │
        ├── once/day  npm run refresh-summaries:product
        │             → analytics_summary (DAU, retention, product_daily_signals, …)
        │
        └── once/day  npm run refresh-ltv:mongo
                      → MongoDB cohort_ltv  (read-only BQ SELECT)
        ▼
Node API  (product facade: Banknote | Coinzy | Compare)
  prefer summary → view → raw events_*
  LTV: Mongo only (BQ only if LTV_FORCE_RAW / empty + fallback flag)
        ▼
React dashboard
```

**Cost idea:** pay BigQuery **once per day** (refresh). Users click all day against summaries or Mongo.

### Products — never mix

| | Banknote | Coinzy |
|--|----------|--------|
| GCP | `banknote-app-4f3fd` | `coinzy-26a4d` |
| Dataset | `analytics_488476338` | `analytics_487601380` |
| Summary | `analytics_summary` | `analytics_summary` |
| Creds | `GOOGLE_APPLICATION_CREDENTIALS` | `COINZY_GOOGLE_APPLICATION_CREDENTIALS` |
| Color | `#4f8cff` | `#34d399` |

Compare = run the same SQL on each app in parallel, tag rows with the product label.

### How a number is loaded

1. App cache (memory / Redis)
2. Summary table (`analytics_summary.*`) when present
3. Product view (`v_*`)
4. Raw `events_*`
5. Clear error — never fake zeros

Response `source` is `summary` | `view` | `raw` | `mongodb`.

### Identity, country, events (almost every query)

| Field | Rule |
|-------|------|
| User (`resolved_user_id`) | Real GA4 `user_id` → real param `user_id` → `user_pseudo_id`. Skip `anonymous`. |
| **Same-day first ID** | Join **only** on `user_pseudo_id` (empty `user_id` must not collapse devices). |
| Country | `COALESCE(event_params.country, geo.country)` |
| Event base | Strip `_android` / `_ios` |

**DAU (opened the app):** `session_start`, `App_open`, `first_open`. Notifications are **not** DAU (`notification_dau` is separate). `any_event_dau` = anyone with any Firebase event.

Funnels count **distinct users per step independently** — not ordered sessions. Later step > earlier step means another entry or missing instrumentation (“joined without prior step”).

---

## 3. Local start

```bash
cd banknote-analytics-dashboard
npm run setup && npm install && npm run dev
```

Open **http://localhost:5173** (API **:3001**). Needs Node 18+, SA JSON under `secrets/`, and `MONGODB_URI`.

### Daily jobs (after Firebase export, often 08:00–10:00 UTC)

```bash
PRODUCTS=banknote,coinzy DAYS=90 npm run refresh-summaries:product
PRODUCTS=banknote,coinzy DAYS=30 LTV_DAYS=210 npm run refresh-ltv:mongo
```

| Script | Writes |
|--------|--------|
| `refresh-summaries:product` | `{project}.analytics_summary.*` |
| `refresh-ltv:mongo` | Mongo `cohort_ltv` (idempotent window replace; no BQ DDL) |

---

## 4. Environment

```bash
PRODUCTS=banknote,coinzy
GCP_PROJECT=banknote-app-4f3fd
BQ_DATASET=analytics_488476338
GOOGLE_APPLICATION_CREDENTIALS=../secrets/bigquery-banknote-sa.json
USE_SUMMARY_TABLES=true

COINZY_GCP_PROJECT=coinzy-26a4d
COINZY_BQ_DATASET=analytics_487601380
COINZY_GOOGLE_APPLICATION_CREDENTIALS=../secrets/coinzy-analytics-dashboard-sa.json
COINZY_USE_SUMMARY_TABLES=true
COINZY_PREFER_RAW=false

MONGODB_URI=mongodb+srv://...
MONGODB_DB=analytics_dashboard
# REDIS_URL=...
# BQ_MAX_BYTES_BILLED=21474836480   # default 20 GiB abort cap
# LTV_FORCE_RAW / LTV_ALLOW_RAW_FALLBACK  stay off in production
```

Keep `PREFER_RAW=false` unless debugging. Do not commit `.env` or `secrets/*.json`.

---

## 5. Repo map

```text
bigdata/
  docs/PROJECT.md                 ← this file (architecture, formulas, deploy)
  docs/EVENTS-BY-TAB.md           ← tab → Firebase events
  docs/QUERIES-BY-TAB.md          ← tab → SQL file / view / summary
  sql/
    01–08, 10, 14_v_*.sql         ← view builders (deploy scripts)
    scheduled/                    ← summary + LTV SELECT
    dashboard/summary/            ← cheap dashboard reads
    dashboard/raw/                ← expensive fallbacks
    dashboard/product/            ← MVP 01–10 (+ banknote/ / coinzy/ overrides)
    validation/                   ← QA
  scripts/                        ← deploy views / summaries / IAM
  banknote-analytics-dashboard/
    server/                       ← Express API
    src/                          ← React
    scripts/                      ← refresh + discover-events
```

SQL editor lists files from those `sql/` folders. Per-app event names for step funnels: `sql/dashboard/product/banknote/README.md` and `coinzy/README.md`.

---

## 6. Sidebar & formulas

Filters (date, country, platform) apply after **Apply**. Default range = last 30 days. Compare LTV defaults to 210 days. Cohort LTV date filter = **install date**, not purchase date.

Home and Product Analytics **do not query BigQuery**.

### 6.1 Compare (`/compare`)

Runs `product_daily_signals` once per app, tags rows, then:

- Charts = daily series
- Table = rollup (`summarizeProduct()`): last-day DAU, **sum** of installs / paying users, **simple average of daily rates** (quiet day = busy day)

**Leader** = higher is better except quota hit (lower is better).

| Row | Rollup | Daily formula |
|-----|--------|----------------|
| Latest DAU | Last complete day | Distinct open/session/`first_open` |
| Notification DAU | Last day | Push display/receive/interact |
| Any event | Last day | Any Firebase event |
| Installs | Sum | Distinct `first_open` |
| Identify success | Avg of daily rates | success ÷ (success + failure) **events** |
| Identify funnel | Avg | Banknote: success ÷ nav ∪ home. Coinzy: success ∪ Identification_done ÷ camera |
| Scans / user-day | Avg | Successes ÷ DAU |
| Quota hit | Avg | Quota users ÷ scan-attempt users |
| Paywall → purchase | Avg | Confirm **events** ÷ paywall **events** |
| Catalogue / marketplace | Avg | Distinct users ÷ DAU |
| Paying users | Sum of daily distinct | Can double-count across days |
| LTV-30/90/180 | Weighted | Same as Explorer LTV |

### 6.2 Health report (`/report`)

Combined + Banknote + Coinzy tabs: rollup, Identify leak, same-day scan, paywall, Coinzy Expert. Recommendations use the loaded range, not a frozen snapshot.

### 6.3 Ten MVP KPIs

SQL: `sql/dashboard/product/01`–`10_*.sql` (Coinzy override under `product/coinzy/`). Fallback: `raw/16_product_daily_signals.sql`.

| # | Tab | Headline | Formula |
|---|-----|----------|---------|
| 1 | DAU | `dau` | Distinct users with `session_start` / `App_open` / `first_open` |
| 2 | Install → first scan | `day0_first_scan_rate` | Same-day `identification_done_success` ÷ `first_open` **devices**, join on `user_pseudo_id` only |
| 3 | Identify success | `identification_success_rate` | Success **events** ÷ (success + failure). Coinzy failure also counts `Identification_failed` |
| 4 | Quota hit | `free_quota_hit_rate` | Distinct scan-quota users ÷ scan-attempt users (not collection limit) |
| 5 | Paywall → purchase | `paywall_to_confirm_rate` | Confirm **events** ÷ paywall **events**. Unique people, pack mix, and onboarding → purchase are Funnels → Paywall / Onboarding → subs. First-run screens are Funnels → Onboarding |
| 6 | D1 / D4 / D7 | `d1_retention_rate` / `d4` / `d7` / `d4_d7` | Returned any event on D+1 / D+4 / D+7; D4–D7 = any of days 4–7. Cohort = `first_open` |
| 7 | Scans / user | `scans_per_dau` + `scans_p10`…`scans_p99` | Mean = success events ÷ DAU. Percentiles = successful IDs per **scanning** user-day (P10, P25, P50, P75, **P90**, P95, P99) |
| 8 | Identify funnel | `open_to_success_rate` | Banknote: success ÷ (`Identify_bottom_nav` ∪ `Identify_home`). Coinzy: success (`identification_done_success` ∪ `Identification_done`) ÷ camera (`Identification_screen` ∪ `photo_screen`) — nav is not open |
| 9 | Collection vs catalogue | `private_collection_open_rate` · `global_catalogue_open_rate` | Separate rates of DAU — **not** mixed |
| 10 | Marketplace | `marketplace_engagement_rate` | Market nav / `marketplace_screen` / `market_item_expolre` ÷ DAU. **Feed is a separate tab**, not mixed in |

### 6.4 Funnels

Built in `funnel-registry.js` from raw `events_*` (lean columns, **one** scan, cached 24h). No `UNNEST(event_params)`.

```text
users = COUNT(DISTINCT resolved_user_id) for that step’s events
hits  = COUNT(*)
convert = to.users ÷ from.users
dropped = max(0, from − to)
gained  = max(0, to − from)   → joined without prior step
```

| Tab | Core path |
|-----|-----------|
| Identify (all) | Banknote: nav ∪ home → camera → photos → submit → success ∪ `Identification_done` → top 5 → `banknote_details_identification`. Coinzy: **Camera → Photos → Submit → Success → Details** (nav is not the start). After camera, shutter ∥ gallery merge at after-crop |
| Scan · bottom nav | **Cohort** = `Identify_bottom_nav` (Coinzy: minus `Identify_home`, because nav also fires from Home). Later steps only that group |
| Scan · home / banner | **Cohort** = `Identify_home`. Later steps only that group |
| Scan · camera | **Cohort** = shutter (`Photo_clicked` / `photo_clicked_*`). Coinzy core starts at shutter. Banknote core starts at first camera image. No gallery rows |
| Scan · gallery | **Cohort** = gallery (Banknote `photo_uploaded_*`; Coinzy crop/clicked minus `Photo_clicked`). Core starts at gallery pick |
| Collection | Started a session → screen → card → sub-collection → details |
| Global catalogue | Started a session → screen → item → details |
| Marketplace | Nav → screen → listing → sale details → contact |
| Feed | Nav → screen → like/comment |
| Paywall | Impression → confirm (user-unique; MVP 5 is event-count — they will not match) |
| Onboarding | Banknote: started / screen → completed. Coinzy: logo → value 1–5 → login → notification → `Onboarding_complete` |
| Onboarding → subs | Banknote: `subscription_shown` → pack → confirm. Coinzy: `Subs_page_onboarding` pages → pack → confirm |
| Expert | Coinzy only: landing → upload → continue → queued → report (+ credits path) |

Identify needs **both** images on Banknote. Banknote has no `Identification_attempted`; `Identification_done` is logged with success. Details after match is `banknote_details_identification` (result UI `identification_details_screen` is a side row). Coinzy core Photos is after-crop (`photo_clicked_1/2`) where shutter and gallery merge on Identify (all). **Scan · camera** / **Scan · gallery** are separate tabs. `Photo_clicked` is shutter only; gallery tap has no event. Crop is a **side** step on Banknote. Coinzy crop is 0-indexed (`_0` / `_1`). Coinzy add-to-collection **cannot be measured** (no live success event).

### 6.5 Event catalog (`/events-catalog`)

Mapped events per app (funnels + DAU / KPI extras). Filter Banknote / Coinzy. Download unique-event CSV or full usage CSV. No BigQuery.

### 6.6 Event inventory (`/events-explorer`)

One app only. Hits, unique users, daily chart, top 40 params (this query still UNNESTs). Use it to prove an event fires.

### 6.7 Explorer

Prefer summary → view → raw.

| Tab | Formula |
|-----|---------|
| DAU | Same as MVP 1. Country/platform filter always hits raw (summary has no that grain) |
| Unique vs repeat | New vs returning, one-day vs 2+ days |
| Installs + time used | `first_open` devices; “went in” = ≥10s (`engagement_time_msec` or `session_length_seconds`). Time P10–P99 among went-in |
| D0 / D1 percentiles | Install cohort. D0 went-in + D1 opened (DAU events). Time and scans P10, P25, P50, P75, P90, P95, P99 on each day |
| Scan limits | Free vs subscribed (purchase on/before that day, 180-day lookback). Success cap vs unsuccessful cap. No separate Pro limit event |
| Free-scan success quota | Coinzy only. Hit = `free_scan_success_quota_exhausted` (success remaining → 0). Unique people + hits. After-hit: blocked / popup / go premium / not now. Fail exhausted does not block. Banknote TBD |
| MAU | Distinct users in calendar month |
| New users | Distinct `first_open` that day |
| D1 / D7 | Same as MVP 6; future return days excluded |
| Countries | Unique users in range by country (column name `total_new_users` is historical) |
| Platform | Distinct users by OS |
| Top events | `COUNT(*)` hits, top 25 |
| Cohort LTV | See §7 |

Incomplete Firebase days are **omitted**, not shown as 0.

### 6.8 Admin & SQL editor

Users live in Mongo. Sub-admins need ≥1 app and ≥1 page. Compare needs both apps. Monthly reports: previous calendar month, 1st 08:00 UTC, needs SMTP.

SQL Editor runs **your** SQL on the active product. It does not change KPI definitions.

---

## 7. Cohort LTV

```text
LTV-N = USD revenue in N days after first_open ÷ cohort installs
```

Windows: 30 / 90 / 180. Immature → `NULL` (not partial). Channel Organic / Paid / Direct frozen on first `first_open`. Revenue = `in_app_purchase` / `purchase` USD — **not** `Subs_confirm`. Grain in Mongo: `product × cohort_date × country × channel × platform`. API rolls platform up unless filtered.

Normal API path: **Mongo only** (`source: mongodb`, `bytesProcessed: 0`). Emergency: `LTV_FORCE_RAW=true` or `LTV_ALLOW_RAW_FALLBACK=true` when Mongo is empty.

Refresh: `sql/scheduled/cohort_ltv_mongo.sql` → `scripts/refresh-cohort-ltv-mongo.js`.

---

## 8. Events (preferred + aliases)

| Area | Events |
|------|--------|
| Install | `first_open` |
| Identify open (KPI / funnel entry) | Banknote: `Identify_bottom_nav`, `Identify_home`. Coinzy KPI/funnel start: `Identification_screen` / `photo_screen` — nav also fires from Home |
| Photo | Banknote `photo_clicked_1/_2` + gallery `photo_uploaded_1/_2`. Coinzy: shutter = `Photo_clicked`; gallery tap has no event (infer crop/clicked minus shutter); merge = `photo_clicked_1/2` after crop |
| Submit | `photos_submitted`, `photo_submit_button` (Coinzy: not `Identification_done`) |
| Success / fail | `identification_done_success` / `identification_done_failure`. Coinzy success also `Identification_done`; fail also `Identification_failed` |
| Quota (MVP 4) | Banknote: `identiifcation_limit_exceeded`. Coinzy: mixed `Identified_limit_reached` + `free_scan_*`. Not `Collection_limit_Reached` |
| Free-scan success quota | Coinzy experiment tab: **only** `free_scan_success_quota_exhausted`. Not consumed, not `Identified_limit_reached` |
| Paywall | `Subs_page`, `Subs_page_discount`, Coinzy `Subscription_screen` / `Subs_page_onboarding` → Banknote `Subs_confirm` · Coinzy `subs_confirm` / `paid_purchase` |
| Catalogue | `Collection_screen`, `Global_catalogue_screen`; details `banknote_details_*` / `Coin_details_*` |
| Marketplace | `marketplace_screen`, `market_item_expolre`, `market_contact` |
| Feed | `Feed_screen`, `feed_like`, `feed_comment` |
| Expert (Coinzy) | `expert_evaluation_landing` → upload → queued → `expert_evaluation_report` |

Must-log for MVP: `first_open` · Identify open · success/failure · quota · paywall → confirm · collection · marketplace.

---

## 9. SQL, views, summaries

| Folder | Role |
|--------|------|
| `sql/dashboard/product/01`–`10` | MVP (views) |
| `sql/dashboard/product/{app}/` | Per-app override (same filename wins) |
| `sql/dashboard/raw/` | Fallback + explorer extras (`20_install_day_usage`, `21_scan_limits`, …) |
| `sql/dashboard/summary/` | Cheap reads of `analytics_summary` |
| `sql/scheduled/` | Daily materialize |
| `sql/01`–`08`, `10`, `14` | `CREATE VIEW` |

```bash
./scripts/deploy-product-metrics.sh          # Banknote identify / engagement / subs / first-scan
GCP_PROJECT=… BQ_DATASET=… ./scripts/deploy-product-views.sh   # full view set
bq mk --dataset --location=US PROJECT:analytics_summary
PROJECT=… DATASET=… ./scripts/deploy-scheduled-summaries.sh
```

Summary tables: `daily_active_users`, `monthly_active_users`, `daily_new_users`, `daily_retention`, `country_metrics`, `platform_metrics`, `top_events`, `product_daily_signals`.

Each SA needs **BigQuery Job User** + **Data Viewer** on `events_*`. **Data Editor** is required to create views.

---

## 10. Cost

You pay for **bytes scanned**, not rows returned (`~$6.25 / TiB`). Nested `event_params` is expensive.

| Traffic | Typical |
|---------|---------|
| Summary / Mongo / cache hit | ~free vs raw |
| Funnels | One lean raw scan, 24h cache |
| Event params / SQL Editor / missing summary | Gigabytes — keep ranges short |
| Daily refresh | Once per product per day |

Ops: refresh summaries daily · `USE_SUMMARY_TABLES=true` · `BQ_MAX_BYTES_BILLED` · GCP budget alerts (Billing → Budgets, service = BigQuery). Runtime bytes: `GET /api/cache/stats`.

---

## 11. Add another app

1. SA JSON in `secrets/` (Data Viewer min).
2. `.env`:

```bash
PRODUCTS=banknote,coinzy,YOURAPP
PRODUCT_YOURAPP_LABEL=YourApp
PRODUCT_YOURAPP_GCP_PROJECT=…
PRODUCT_YOURAPP_BQ_DATASET=analytics_XXXXXXXXX
PRODUCT_YOURAPP_GOOGLE_APPLICATION_CREDENTIALS=../secrets/yourapp-sa.json
PRODUCT_YOURAPP_PREFER_RAW=true
PRODUCT_YOURAPP_COLOR=#a78bfa
```

3. Optional: `PRODUCT_CATALOG` in `src/lib/product.tsx`.
4. Restart `npm run dev`. Switcher + Compare pick up `registry.list()`.
5. Same event contract as above. Entity param e.g. `stamp_id`. Stay on raw until views are deployed.

---

## 12. Deploy (Render + Docker)

Do **not** use Vercel/Netlify — long BigQuery jobs and `sql/` on disk. Repo: `shreyans-eng/dashboard_analytic_apps`.

| Field | Value |
|-------|--------|
| Runtime | Docker · Dockerfile at repo root |
| Root Directory | **empty** |
| Health | `/api/live` |
| Region | Oregon (US) near BigQuery `US` |

Env (non-secret): `NODE_ENV=production`, `HOST=0.0.0.0`, `SQL_ROOT=/sql`, `PRODUCTS=banknote,coinzy`, GCP project/dataset keys from §4, `USE_SUMMARY_TABLES=true`, `COINZY_PREFER_RAW=false`, `DASHBOARD_AUTH_ENABLED=true`, `MONGODB_DB=analytics_dashboard`. Do **not** set `PORT`.

Secrets: `DASHBOARD_USERNAME` / `PASSWORD`, `AUTH_SECRET`, `MONGODB_URI`, `GOOGLE_CREDENTIALS_JSON` and `COINZY_GOOGLE_CREDENTIALS_JSON` (paste entire JSON, `{`…`}`).

Atlas: allow Render IP or `0.0.0.0/0`. Logs should show `creds: true` for both apps and `MongoDB: connected`.

Local Docker: `docker build -t banknote-analytics . && docker compose up --build` → http://localhost:3001

SMTP (monthly reports): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `REPORT_EMAIL`, `DASHBOARD_PUBLIC_URL`. Keep instance on **Starter** so it does not sleep through the 1st-of-month send.

Blueprint: `render.yaml`.

---

## 13. Healthy system

| Check | Signal |
|-------|--------|
| LTV | Refresh prints MB once; API `source: mongodb`, `bytesProcessed: 0` |
| DAU / Compare | `source: summary` after refresh |
| Auth | Login via Mongo `users` |
| `/api/live` | `{"ok":true}` |
| `/api/health` | Both products `connected` |

Empty charts: confirm the event in Event inventory. Missing events look like 0%, not an API error.

### Read numbers without fooling yourself

1. Rates need a denominator glance (50% of 10 ≠ 50% of 10,000).
2. Funnels / catalogue = **users**. MVP 3 and MVP 5 = **events**.
3. Same-day windows (MVP 2, MVP 8) are calendar day, not multi-day journeys.
4. Compare uses shared signals; a single-app MVP tab may use a richer view — small differences are expected.

### Cheat sheet

```text
DAU                      = distinct session_start / App_open / first_open
Day-0 first scan         = same-day success ÷ first_open devices (user_pseudo_id)
Identify success         = success events ÷ (success + failure)
Quota hit                = quota users ÷ scan-attempt users
Paywall MVP              = confirm events ÷ paywall events
Scans / DAU              = success events ÷ DAU
Open → success           = Banknote: success ÷ nav ∪ home. Coinzy: success ∪ Identification_done ÷ camera
Catalogue                = Collection_screen ∪ Global_catalogue_screen ÷ DAU
Marketplace              = market screen / nav / listing tap ÷ DAU (not Feed)
LTV-N                    = revenue days 0…N-1 after install ÷ installs
```

---

## 14. Remaining ops (Aug 2026)

Deploy product views when IAM allows (`deploy-product-views.sh`). Refresh summaries daily (SA needs Job User + Data Editor on `analytics_summary`). Coinzy may stay on raw until Data Editor is granted. MVP 2 needs the first-scan SQL/views (join is `user_pseudo_id` only — already in repo).
