# BigQuery Cost Audit

**Project:** `banknote-app-4f3fd` · **Raw dataset:** `analytics_488476338` · **Summary dataset:** `analytics_summary`  
**Audit date:** 2026-08-06 · **Stack:** React → Express → BigQuery ← Firebase export

---

## Executive Summary

| Metric | Before refactor | After refactor |
|--------|------------------|----------------|
| Queries per Executive page load | 9 (8 charts + KPI) | 1 KPI (cached) |
| Queries per full dashboard visit | ~15+ | ~8 (one per tab, cached) |
| Raw `events_*` scans from dashboard | Every request | **Never** (summary tables only) |
| Server cache | None → 1h uniform | Per-metric TTL (1–24h) + optional Redis |
| Client cache | None | TanStack Query (dedup + stale-while-revalidate) |

**Estimated cost reduction:** 95–99% for dashboard traffic (summary scans ~1–50 MB vs raw events ~1–10 GB per query).

---

## Endpoint Inventory

### Dashboard endpoints

| Endpoint | Repository method | SQL file | Raw events? | Est. scan (after) | Est. scan (legacy fallback) | Recommendation |
|----------|-------------------|----------|-------------|-------------------|----------------------------|----------------|
| `POST /api/kpi` | `getKpi()` | `dashboard/summary/kpi.sql` | No | ~5 MB | ~5–15 GB (5 view queries) | ✅ Single summary query, 24h cache |
| `POST /api/dashboard/executive` | `getExecutive()` | Multiple summary SQL | No | ~20 MB (parallel, cached) | ~30+ GB | ✅ Consolidated API; use for bulk loads |
| `POST /api/query/dashboard/dau` | `getDailyUsers()` | `summary/01_dau.sql` | No | ~1 MB | ~2–5 GB | ✅ `analytics_summary.daily_active_users` |
| `POST /api/query/dashboard/mau` | `getMonthlyUsers()` | `summary/02_mau.sql` | No | ~500 KB | ~2–5 GB | ✅ |
| `POST /api/query/dashboard/new-users` | `getNewUsers()` | `summary/03_new_users.sql` | No | ~1 MB | ~3–8 GB | ✅ |
| `POST /api/query/dashboard/countries` | `getCountries()` | `summary/04_countries.sql` | No | ~2 MB | ~5 GB | ✅ |
| `POST /api/query/dashboard/d1` | `getD1Retention()` | `summary/05_d1_retention.sql` | No | ~1 MB | ~5–10 GB | ⚠️ Merge with d7 (shared table scan) |
| `POST /api/query/dashboard/d7` | `getD7Retention()` | `summary/06_d7_retention.sql` | No | ~1 MB | ~5–10 GB | ⚠️ Duplicate of d1 scan — use `09_retention.sql` |
| `POST /api/query/dashboard/events` | `getTopEvents()` | `summary/07_top_events.sql` | No | ~5 MB | ~3–8 GB | ✅ 1h cache (more volatile) |
| `POST /api/query/dashboard/platform` | `getPlatformBreakdown()` | `summary/08_platform.sql` | No | ~1 MB | ~2–5 GB | ✅ |

### Monitoring endpoints

| Endpoint | BigQuery? | Scan | Notes |
|----------|-----------|------|-------|
| `GET /api/health` | Yes (`SELECT 1`) | ~0 | Connectivity only |
| `GET /api/dashboard/status` | Yes (7× `MAX(refreshed_at)`) | ~7 KB | Summary metadata |
| `GET /api/config` | No | — | Env config |
| `GET /api/cache/stats` | No | — | In-memory/Redis stats |

### Ad-hoc / admin

| Endpoint | SQL | Raw events? | Est. scan | Recommendation |
|----------|-----|-------------|-----------|----------------|
| `POST /api/query/run` | User-supplied | **Maybe** | Unbounded | SQL Editor only; add bytes warning in UI |
| `POST /api/admin/refresh-summaries` | `sql/summary/refresh_*.sql` | Indirect (via views) | ~10–30 GB | Run once/day via cron, not from dashboard |
| `GET /api/test/bigquery` | Removed raw count | No | ~0 | Dev ping only |

---

## Duplicate Queries Identified

| Duplicate | Pages affected | Fix applied |
|-----------|---------------|-------------|
| KPI + individual dau/mau/d1/d7 | Executive + Engagement + Retention | Executive = KPI only; tabs lazy-load |
| d1 + d7 retention | Retention | Shared `daily_retention` table; combined `09_retention.sql` available |
| `/api/kpi` + 5 parallel queries (fallback) | Executive | Single `kpi.sql` on summary tables |
| `dashboard/*.sql` ↔ `queries/*.sql` ↔ `metabase-starter/*` | SQL Editor library | Document: use `dashboard/summary/` only for prod |

---

## Raw `events_*` Scan Chain (legacy path — avoid)

```
events_*
  └─ v_events_normalized          ← full table scan
       ├─ v_daily_active_users    ← dashboard DAU, platform
       ├─ v_monthly_active_users  ← dashboard MAU
       ├─ v_new_users             ← new users, retention cohorts
       ├─ v_country_metrics       ← countries
       ├─ v_retention_cohorts     ← D1/D7
       └─ dashboard/07_top_events  ← direct on normalized view
```

**Scheduled queries** (`sql/scheduled/`) scan raw events **once per day** and write to `analytics_summary.*`.

---

## Per-Metric Cache TTL

| Metric | Server TTL | Client staleTime | Rationale |
|--------|-----------|------------------|-----------|
| DAU, MAU, new users | 24h | 24h | Firebase daily export |
| Countries, platform, retention | 24h | 24h | Same |
| Top events | 1h | 1h | More exploratory |
| KPI, executive | 24h | 24h | Derived from above |
| Status | 5min | 5min | Freshness metadata |

---

## Optimization Checklist

- [x] Summary tables in separate `analytics_summary` dataset
- [x] Dashboard SQL uses `{SUMMARY_DATASET}` — never `events_*`
- [x] Repository layer — no raw SQL in routes
- [x] Server cache with per-metric TTL
- [x] Optional Redis (`REDIS_URL`)
- [x] TanStack Query client-side deduplication
- [x] Lazy tab loading (React Router unmount)
- [x] Consolidated `/api/dashboard/executive`
- [x] `_TABLE_SUFFIX` filters in all scheduled SQL
- [x] Partitioned + clustered summary tables
- [x] Bytes tracking in `metrics-tracker.js`
- [ ] Deploy scheduled queries in GCP (manual step)
- [ ] Grant SA `bigquery.tables.create` on `analytics_summary`

---

## Estimated Monthly Cost (example)

Assumptions: 10 dashboard users, 50 page views/day, summary tables deployed.

| Component | Queries/day | Avg bytes | Daily cost @ $5/TB |
|-----------|-------------|-----------|-------------------|
| Dashboard (cached) | ~20 unique | 50 MB | $0.005 |
| Scheduled refresh | 7 jobs | 15 GB | $0.075 |
| **Total** | | | **~$2.40/month** |

Without optimization: 50 views × 9 queries × 5 GB = **~2.25 TB/day ≈ $11/day ≈ $330/month**.
