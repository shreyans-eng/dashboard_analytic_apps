# How to keep BigQuery cost down

Firebase `events_*` tables are **columnar and date-sharded**. You pay for **bytes scanned**, not rows returned. A 30-day dashboard click that reads `event_params` (a fat nested STRUCT) is often **10–50×** more expensive than reading `event_name` + `user_id` + `user_pseudo_id` from the same days.

On-demand pricing is about **$6.25 per TiB** scanned (check current Google pricing). Cache hits and summary-table reads are essentially free compared with raw.

---

## 1. What actually costs money

| Traffic | Typical scan | When it happens |
|---------|----------------|-----------------|
| **Summary tables** (`analytics_summary.*`) | Megabytes | Explorer DAU/MAU/events, Compare, most MVP KPIs — **after refresh** |
| **Product views** (`v_*`) | Same as raw underneath | Banknote MVP if views wrap `events_*` |
| **Raw `events_*`** | Gigabytes per query | Funnels, event **detail** params, SQL Editor, any fallback when summary is missing |
| **Daily refresh job** | One raw window per product | `npm run refresh-summaries:product` |

**Worst old pattern (now fixed in code):**

1. Coinzy MVP skipped summary and scanned raw **once per KPI** (10 tabs ≈ 10 full scans).
2. Funnel SQL used `UNION ALL … FROM base` — BigQuery often **inlines** the CTE, so 15 steps ≈ **15 scans** of the same days, plus `UNNEST(event_params)`.
3. Event inventory always scanned raw, including `event_params`.
4. Event detail ran **three** raw queries (daily + totals + params).
5. Country dropdown on every page fired a countries query even if you never opened it.

---

## 2. What the dashboard does now

| Area | Cost path |
|------|-----------|
| **MVP 1, 3–5, 7–10 + Compare** | Read `product_daily_signals` (summary). One cached raw scan only if that table is missing. All those KPIs **share** the same cached signals query. |
| **MVP 6 retention + Explorer** | Summary `daily_retention` / `daily_active_users` / etc. first |
| **MVP 2 time-to-first-scan** | Still needs product SQL / views (not in the signals table). Avoid opening it on a huge date range unless summaries/views exist. |
| **Funnels** | **One** raw scan of `event_name`, `user_id`, `user_pseudo_id` only. Cached 24h. No `event_params`. |
| **Event inventory** | `top_events` summary first. Raw fallback without `event_params`. |
| **Event detail** | One raw scan (`GROUP BY ROLLUP`) + one params query (this one still UNNESTs). Cached. |
| **Country filter** | Loads country list **only when you open the dropdown** |
| **Query cap** | Jobs abort if they would scan more than `BQ_MAX_BYTES_BILLED` (default **20 GiB**) |
| **BQ result cache** | `useQueryCache: true` — identical SQL within ~24h is free on Google’s side too |

Identity on interactive raw scans is now:

```text
COALESCE(user_id, user_pseudo_id)
```

We no longer UNNEST `event_params.user_id` on funnels / inventory / signals refresh. That is the large nested column. Logged-in users still match on top-level `user_id`.

---

## 3. What you should do (ops)

### A. Refresh summaries every day (biggest lever)

Do this **after** the Firebase daily export lands (often ~08:00–10:00 UTC):

```bash
cd banknote-analytics-dashboard
PRODUCT=banknote DAYS=90 npm run refresh-summaries:product
PRODUCT=coinzy DAYS=90 npm run refresh-summaries:product
```

Or both: `PRODUCTS=banknote,coinzy DAYS=90 npm run refresh-summaries:product`

Without this, Coinzy/Banknote Compare and MVP fall back to **raw** `events_*`.

On Render, add a **cron** (same Docker command, `DAYS=90`). Refreshing 90 days once is cheaper than 50 people each scanning 30 raw days all afternoon.

### B. Keep `USE_SUMMARY_TABLES=true` and `PREFER_RAW=false`

In `.env` / Render:

```bash
USE_SUMMARY_TABLES=true
COINZY_USE_SUMMARY_TABLES=true
# do not set PREFER_RAW=true unless you are debugging
```

### C. Use a 7–30 day range in the UI

Bytes scale with **days × columns**. Default is 30 days. A 365-day funnel is the expensive click. Prefer 7 or 30, then widen only for Explorer summary tabs.

### D. Do not use SQL Editor for `SELECT * FROM events_*`

That reads **every nested field**. Prefer:

```sql
SELECT event_date, event_name, user_id, user_pseudo_id
FROM `project.dataset.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260801' AND '20260814'
LIMIT 100
```

Always filter `_TABLE_SUFFIX` (or `event_date`) so you do not scan the whole export history.

### E. Optional: raise/lower the byte cap

```bash
# 20 GiB default. Example: 8 GiB
BQ_MAX_BYTES_BILLED=8589934592
```

If a funnel or SQL Editor job fails with “bytes billed exceeded”, either narrow dates or raise the cap **for that environment only**.

### F. Redis cache in production

Set `REDIS_URL` if you have Redis. Otherwise the server uses in-memory cache (lost on restart → more BQ). Render: add a Redis instance and the env var.

---

## 4. How to measure cost

### In the API response

Most analytics JSON includes `bytesProcessed` and `source` (`summary` | `view` | `raw` | `product`).

- `source: summary` + a few MB → good  
- `source: raw` + several GB → that click is the bill  

### Dry-run in BigQuery (no charge)

```bash
bq query --use_legacy_sql=false --dry_run --project_id=coinzy-26a4d '
SELECT COUNT(*) FROM `coinzy-26a4d.analytics_487601380.events_*`
WHERE _TABLE_SUFFIX BETWEEN "20260801" AND "20260814"
'
```

The dry-run prints **bytes that would be billed**.

### GCP console

Billing → BigQuery → bytes billed. Filter by `user_email` of the dashboard service account.

---

## 5. Query rules (for any new SQL)

1. **Partition:** `_TABLE_SUFFIX BETWEEN start AND end` (never omit on `events_*`).
2. **Columns:** only `event_name`, `event_date`, `user_id`, `user_pseudo_id` unless you truly need params / geo / device.
3. **No `SELECT *`.**
4. **No `UNNEST(event_params)`** on dashboard paths; do it in a daily summary job if needed.
5. **One scan:** aggregate with `COUNTIF` / `COUNT(DISTINCT IF(...))` — do not `UNION ALL` the same `events_*` CTE (BigQuery inlines CTEs).
6. **Materialize** repeating KPIs into `analytics_summary` (partition by `event_date`).
7. **Cache** identical dashboard requests for 12–24h (Firebase is not real-time).

---

## 6. Expected cost shape (order of magnitude)

After summaries exist and the new SQL is live:

| Action | Rough scan |
|--------|------------|
| Open DAU / most MVP / Compare | Summary table (MB) |
| Open Identify funnel, 30 days | One raw scan of 3 columns (often well under a few GB) |
| Event inventory | Summary `top_events` (MB) |
| Click one event for params | One extra raw scan **with** `event_params` for that event name |
| Daily 90-day summary refresh × 2 apps | One raw window each — pay this once, not per user |

If numbers look “too cheap” in the UI, check `source` on the payload. If it says `raw`, run the refresh commands in §3A.

---

## 7. Related docs

- Architecture: [`06-summary-architecture.md`](./06-summary-architecture.md)
- What each tab calculates: [`07-dashboard-tabs-and-calculations.md`](./07-dashboard-tabs-and-calculations.md)
- Event names / KPI SQL: [`03-full-queries-and-events.md`](./03-full-queries-and-events.md)
