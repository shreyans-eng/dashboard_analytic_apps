# Full system guide — data, cache, BigQuery, cost, optimization

One document for how the **Banknote Analytics Dashboard** codebase works end-to-end: where data lives, how requests flow, how BigQuery is billed, and how we keep cost down.

**Prefer the canonical flow doc first:** [00-project-end-to-end-flow.md](./00-project-end-to-end-flow.md).

For LTV-specific metric rules see [09-cohort-ltv.md](./09-cohort-ltv.md) and [10-cohort-ltv-full-flow.md](./10-cohort-ltv-full-flow.md).  
For tab-by-tab formulas see [07-dashboard-tabs-and-calculations.md](./07-dashboard-tabs-and-calculations.md).

---

## 1. Big picture (what this system is)

```text
Mobile apps (Banknote / Coinzy)
        │  Firebase Analytics events
        ▼
Google Cloud BigQuery — RAW events_*     ← source of truth (never mutate)
        │
        ├─ daily refresh-summaries:product ──► analytics_summary.* (DAU, signals, …)
        │
        └─ daily refresh-ltv:mongo ──────────► MongoDB cohort_ltv
                │
                ▼
Node API  +  app cache (memory / Redis)
                │
                ▼
React dashboard (Explorer / MVP / Compare / Funnels / LTV)
```

**MongoDB** stores **users/auth** and the **Cohort LTV** read-model (`cohort_ltv`).  
**BigQuery** remains the analytics source of truth (`events_*`).  
**App cache** stores recent API results so repeat clicks avoid re-hitting stores.

Canonical walkthrough: [00-project-end-to-end-flow.md](./00-project-end-to-end-flow.md).

Banknote and Coinzy use **separate GCP projects, datasets, and service accounts**. Data is never mixed.

---

## 2. Where data is saved (every layer)

| Layer | Where | What is stored | Who writes | Who reads |
|-------|--------|----------------|------------|-----------|
| **1. Device / Firebase** | Firebase Analytics (GA4) | App events | Mobile apps | Firebase → BigQuery export |
| **2. Raw BigQuery** | `{project}.{analytics_*}.events_YYYYMMDD` | Daily shards | Firebase export only | Refresh jobs; rare raw API fallbacks |
| **3. Summary BigQuery** | `{project}.analytics_summary.*` | DAU, retention, signals, … | `refresh-summaries:product` | Explorer / MVP / Compare (when present) |
| **4. MongoDB LTV** | `cohort_ltv` collection | Aggregated LTV-30/90/180 | `refresh-ltv:mongo` | Explorer LTV + Compare LTV |
| **5. MongoDB auth** | `users` (+ settings) | Login, roles, access | Admin / seed | Auth |
| **6. App cache** | Memory and/or Redis | Identical API responses | API | Repeat requests (`cached: true`) |
| **7. Browser** | React Query | UI stale data | Client | Same session |

### Important: what is *not* saved

- Refresh jobs do **not** modify Firebase or raw `events_*`.
- Cohort LTV is **not** stored as a BigQuery table in the Firebase analytics dataset.
- Cache is **derived** data, not the source of truth.

### Product mapping

| Product | GCP project | Raw dataset | Summary dataset |
|---------|-------------|-------------|-----------------|
| Banknote | `banknote-app-4f3fd` | `analytics_488476338` | `analytics_summary` |
| Coinzy | `coinzy-26a4d` | `analytics_487601380` | `analytics_summary` |

Examples:

- Raw: `banknote-app-4f3fd.analytics_488476338.events_20260824`
- Summary Compare/MVP: `….analytics_summary.product_daily_signals`
- **Cohort LTV:** MongoDB collection `cohort_ltv` (daily BQ → Mongo refresh; API does not scan events_*)

---

## 3. Service accounts (Google Cloud identity)

The API and refresh script authenticate to BigQuery with JSON keys (paths in `.env`).

| Product | Service account | Env var (key file) |
|---------|-----------------|--------------------|
| Banknote | `metabase-local-dev@banknote-app-4f3fd.iam.gserviceaccount.com` (legacy GCP name; dashboard SA) | `GOOGLE_APPLICATION_CREDENTIALS` → `secrets/bigquery-banknote-sa.json` |
| Coinzy | `analytics-dashboard-coinzy@coinzy-26a4d.iam.gserviceaccount.com` | `COINZY_GOOGLE_APPLICATION_CREDENTIALS` |

**Needed IAM**

| Capability | Why |
|------------|-----|
| Run BigQuery jobs (`bigquery.jobUser`) | Every query |
| Read raw + summary | Dashboard + refresh |
| **Data Editor** on `analytics_summary` | Create/refresh summary tables |
| Optional `datasets.create` | Only once, if `analytics_summary` does not exist |

If summary dataset is missing and the SA cannot create it, LTV/MVP fall back to expensive **raw** scans until someone creates the dataset and grants Data Editor.

---

## 4. How Firebase and BigQuery work together

1. Apps log events to **Firebase Analytics**.
2. Firebase is linked to a **GCP project**.
3. Once per day (plus optional intraday), Firebase exports into BigQuery tables `events_YYYYMMDD`.
4. Our SQL filters with `_TABLE_SUFFIX BETWEEN 'start' AND 'end'` so we only scan needed days.
5. We **never** treat Firebase as a query API for the dashboard — everything analytics goes through BigQuery.

Firebase = collection. BigQuery = warehouse. Summary tables = dashboard speed/cost layer.

---

## 5. How BigQuery works (and how you are billed)

### Basics

- BigQuery is **columnar** and (for Firebase) **date-sharded** (`events_*`).
- You pay mainly for **bytes scanned** (on-demand), not for “how many rows the chart shows”.
- Reading fat nested columns like `event_params` is much more expensive than reading `event_name` + `user_id` + `user_pseudo_id`.
- Rough list price order of magnitude: **~$6.25 / TiB** scanned (confirm current Google pricing).

### What a dashboard click does in BQ

```text
API builds SQL → createQueryJob (location US)
  → maximumBytesBilled cap (default 20 GiB)  [safety kill switch]
  → useQueryCache: true                     [Google’s own ~24h result cache]
  → job runs → rows + totalBytesProcessed
  → API returns rows, bytesProcessed, source
```

Code: `server/services/analytics/bigquery-client.js`.

### `source` field (critical for cost)

| `source` | Meaning | Typical cost |
|----------|---------|--------------|
| `summary` | Read `analytics_summary.*` | Cheap (MB) |
| `view` | Legacy BigQuery view (often still expensive underneath) | Medium–high |
| `raw` | Scan `events_*` | Expensive (GB) |
| `mixed` | Compare: products used different paths | Check `sources` |

Always check `source` and `bytesProcessed` in the API JSON.

---

## 6. Summary tables (what gets saved in `analytics_summary`)

Created/updated by:

```bash
cd banknote-analytics-dashboard
PRODUCTS=banknote,coinzy DAYS=90 npm run refresh-summaries:product
```

| Table | Grain | Used by |
|-------|-------|---------|
| `daily_active_users` | date × platform × country | Explorer DAU |
| `monthly_active_users` | month × … | MAU |
| `daily_new_users` | cohort_date × … | New users |
| `daily_retention` | cohort_date × … | D1 / D7 |
| `country_metrics` | date × country | Countries |
| `platform_metrics` | date × platform | Platform |
| `top_events` | date × event | Top events / inventory |
| `product_daily_signals` | date | MVP KPIs + Compare (`dau`/`app_open_dau`, `notification_dau`, `any_event_dau`) |
| `event_inventory_daily` | optional | Discovery |

**Cohort LTV** uses MongoDB collection `cohort_ltv` (see §13) — not an `analytics_summary` / BigQuery write table.

SQL lives in `sql/scheduled/*.sql`.  
Pattern is always **idempotent**: `CREATE TABLE IF NOT EXISTS` → `DELETE` window → `INSERT`.

Dashboard readers: `sql/dashboard/summary/*.sql`  
Raw fallbacks: `sql/dashboard/raw/*.sql`

---

## 7. Full request flow (code path)

### A. User opens a chart (Explorer / MVP / LTV)

```text
React page (src/pages/*)
  → useAnalytics / React Query (browser cache)
  → /api/...  (Express routes)
  → ProductAnalyticsFacade (product-registry.js)
       pick Banknote | Coinzy | Compare
  → AnalyticsRepository (per product)
       1) check app cache (Redis or memory)
       2) on miss: preferRaw? → raw
          else try summary → else view → else raw
       3) runQuery(BigQuery) with that product’s SA
       4) store result in app cache with TTL
  → JSON { rows, source, bytesProcessed, cached }
  → UI renders
```

### B. Compare apps

```text
Compare page
  → fan-out: Banknote query + Coinzy query (parallel, separate projects)
  → merge rows tagged with product label
  → for LTV: compare-ltv also returns source / sources / rolled-up summary
```

### C. Daily refresh (batch, not per user click)

```text
npm run refresh-summaries:product
  → for each product:
       authenticate with that SA
       scan raw events_* once per scheduled SQL file
       write into that product’s analytics_summary
```

Pay **once per day** for refresh; many users then read tiny summary tables.

---

## 8. Cache — everything, clearly

There are **three** caching layers. They solve different problems.

### Layer A — App cache (our server)

| Item | Detail |
|------|--------|
| Code | `server/cache/` (`index.js`, `memory.js`, `redis.js`, `ttl.js`) |
| Backend | Redis if `REDIS_URL` works; else **in-memory** |
| Key shape | `banknote:{product}:{query}:{params JSON}` |
| Behavior | On hit → **no BigQuery job**. Response includes `cached: true` |
| Lost when? | Memory: **process restart**. Redis: survives restarts |

**TTL (approx.)**

| Metric class | TTL |
|--------------|-----|
| DAU / MAU / new users / retention / LTV / funnels / KPI / Compare signals | **24h** |
| Top events | **1h** |
| Event inventory / detail | **12h** |
| Status / health | **5m** |

Same filters + same product + same metric within TTL = free (no BQ).  
Change date range / country / product = new key = may hit BQ again.

### Layer B — BigQuery result cache (Google)

- Enabled via `useQueryCache: true` on jobs.
- Identical SQL within ~24h can be free on Google’s side too.
- Does **not** replace summary tables; still better to read summary.

### Layer C — React Query (browser)

- Client `staleTime` avoids refetch spam while you click around.
- Does **not** reduce cost for *other* users or other machines.
- Clearing browser / hard refresh can re-call the API (which may still hit app cache).

### What cache does *not* do

- Does not refresh summary tables.
- Does not fix missing `analytics_summary` (you still need the refresh job).
- Does not share memory cache across multiple API instances (use Redis in prod).

---

## 9. MongoDB (auth only)

| Piece | Role |
|-------|------|
| `server/db.js` | Mongo connection |
| Users / roles / permissions | Who can open Explorer, LTV, admin, etc. |
| Not used for | DAU, LTV, funnels, Compare metrics |

Analytics answers always come from BigQuery (+ caches above).

---

## 10. Repo map (where to look in code)

```text
bigdata/
  sql/
    scheduled/          # materialize analytics_summary (paid raw scans, once/day)
    dashboard/summary/  # cheap dashboard reads
    dashboard/raw/      # expensive fallback
    validation/         # reconciliation
  docs/                 # this file and related guides
  banknote-analytics-dashboard/
    scripts/refresh-product-summaries.js
    server/
      index.js / routes/          # HTTP API
      cache/                      # memory + Redis
      services/analytics/
        product-registry.js       # multi-product facade, compare, funnels
        analytics-repository.js   # summary→raw, QUERY_MAP
        bigquery-client.js        # jobs, byte cap, bytesProcessed
    src/                          # React UI
    .env                          # projects, datasets, SA paths, flags
```

Key flags:

```bash
USE_SUMMARY_TABLES=true
COINZY_USE_SUMMARY_TABLES=true
COINZY_PREFER_RAW=false
BQ_MAX_BYTES_BILLED=...          # default 20 GiB
REDIS_URL=...                    # optional but recommended in prod
```

---

## 11. Cost model (what costs money)

| Action | Typical scan | When you pay |
|--------|--------------|--------------|
| Open DAU / most MVP / Compare **with summaries** | MB | Tiny |
| Open Cohort LTV / Compare LTV **after Mongo refresh** | MongoDB (no BQ) | ~0 BQ bytes |
| Open LTV with `LTV_FORCE_RAW` / empty Mongo + fallback | Raw `events_*` | High |
| Funnel (30d, lean columns) | often &lt; few GB, cached 24h | Medium, once per key |
| Event detail with `event_params` | larger | Higher |
| SQL Editor `SELECT * FROM events_*` | huge | Avoid |
| Daily `refresh-summaries:product` | GB once per product/window | Pay **once**, save all day |

**Old expensive patterns (already fixed in code where noted):**

- One raw scan **per KPI** instead of shared `product_daily_signals`
- Funnel SQL that re-scans the same days many times (`UNION ALL` of same CTE)
- UNNEST `event_params` on every interactive path
- Prefetching country list on every page load

---

## 12. How to optimize (checklist)

### Must-do (ops)

1. **Refresh summaries daily** after Firebase export (~08:00–10:00 UTC):
   ```bash
   PRODUCTS=banknote,coinzy DAYS=90 npm run refresh-summaries:product
```
   (Refreshes DAU/Compare/etc. summaries — **not** LTV; LTV always uses raw.)
2. Keep **`USE_SUMMARY_TABLES=true`** and **`PREFER_RAW=false`** in production.
3. Ensure **`analytics_summary`** exists in **both** projects; SA has Data Editor.
4. Add **`REDIS_URL`** in production so restarts do not flush cache.
5. Prefer **7–30 day** UI ranges; widen only when needed (bytes scale with days).

### Must-do (engineering / SQL)

1. Prefer summary tables for any KPI users open often (DAU, Compare, LTV, …).
2. On raw paths: filter `_TABLE_SUFFIX`; select only needed columns; avoid `SELECT *`.
3. Avoid `UNNEST(event_params)` on interactive queries; push that into scheduled jobs.
4. One scan per query — aggregate with `COUNTIF`, do not re-read the same days via `UNION ALL`.
5. Keep `BQ_MAX_BYTES_BILLED` as a safety net.
6. Cache identical dashboard requests 12–24h (already default for most metrics).

### How to verify optimization is working

| Check | Good | Bad |
|-------|------|-----|
| API `source` | `summary` | `raw` for everyday tabs |
| `bytesProcessed` | KB–MB | multi-GB on DAU/LTV |
| `cached` | `true` on second identical click | always `false` after restart (no Redis) |
| GCP billing by SA email | Stable daily refresh spike + small daytime | Spikes on every user click |

Dry-run (no charge):

```bash
bq query --use_legacy_sql=false --dry_run --project_id=coinzy-26a4d '
SELECT COUNT(*) FROM `coinzy-26a4d.analytics_487601380.events_*`
WHERE _TABLE_SUFFIX BETWEEN "20260801" AND "20260814"
'
```

---

## 13. Cohort LTV in this same model

| Step | Where |
|------|--------|
| Events | Firebase → raw `events_*` (read-only) |
| Daily job | `npm run refresh-ltv:mongo` → MongoDB `cohort_ltv` |
| API | Mongo filters + pagination → `source: mongodb` |
| Emergency | `LTV_FORCE_RAW` / explicit `LTV_ALLOW_RAW_FALLBACK=true` only |
| Cache | App Redis/memory ~24h |

```bash
PRODUCTS=banknote,coinzy DAYS=30 LTV_DAYS=210 npm run refresh-ltv:mongo
```
---

## 14. End-to-end story in one paragraph

Apps send events to **Firebase**, which exports them into **Google BigQuery** raw tables. A **service account** per product runs a **daily refresh** that scans raw once and saves aggregates into **`analytics_summary`**. The **Node API** prefers those summary tables, falls back to raw if missing, then stores the JSON result in **memory/Redis cache**. The **React** app displays charts; **MongoDB** only handles login/permissions. You optimize cost by keeping summaries fresh, using summary `source`, caching in Redis, avoiding wide raw scans and `event_params` on interactive paths, and paying for one refresh instead of many user-driven raw queries.

---

## 15. Related docs

| Doc | Topic |
|-----|--------|
| [06-summary-architecture.md](./06-summary-architecture.md) | Summary layer design |
| [08-bigquery-cost.md](./08-bigquery-cost.md) | Cost deep dive |
| [10-cohort-ltv-full-flow.md](./10-cohort-ltv-full-flow.md) | LTV Firebase/GCP/SA flow |
| [07-dashboard-tabs-and-calculations.md](./07-dashboard-tabs-and-calculations.md) | What each tab calculates |
| [scheduled-summaries-deployment.md](./scheduled-summaries-deployment.md) | Deploying scheduled refresh |
