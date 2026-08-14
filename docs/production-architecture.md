# Production Analytics Architecture

Banknote AI analytics — optimized for low cost, scalability, and daily Firebase export cadence.

---

## Current Architecture (before)

```
React Dashboard
      ↓ (every page load, every filter change)
Express API (raw SQL in routes)
      ↓ (8+ parallel queries per page)
BigQuery Views (v_events_normalized)
      ↓ (full scan)
Firebase events_* tables
```

**Problems:** No cache, no pre-aggregation, expensive at scale, polling wasted on daily data.

---

## Optimized Architecture (after)

```
Firebase Analytics
        ↓ daily export (~08:00 UTC)
events_YYYYMMDD  (+ optional events_intraday_*)
        ↓ scheduled queries (once/day)
analytics_summary dataset
  ├── daily_active_users
  ├── monthly_active_users
  ├── daily_new_users
  ├── daily_retention
  ├── country_metrics
  ├── platform_metrics
  └── top_events
        ↓ cheap partitioned scans (~MB)
Express Repository Layer (AnalyticsRepository)
        ↓ check cache (Redis or in-memory)
Cache Layer (24h daily / 1h events)
        ↓
React + TanStack Query (dedup, stale cache)
        ↓
Dashboard (lazy per tab)
```

---

## Layer Details

### 1. Raw events (historical only)

- Dataset: `analytics_488476338`
- Tables: `events_*`, optionally `events_intraday_*`
- **Never queried by dashboard UI**
- Used only by scheduled aggregation jobs

### 2. Summary tables

- Dataset: `analytics_summary`
- SQL: `sql/scheduled/*.sql`
- Deployment: [scheduled-summaries-deployment.md](./scheduled-summaries-deployment.md)
- Partitioned by date, clustered by dimensions
- Each row includes `refreshed_at` timestamp

### 3. Repository layer

Location: `banknote-analytics-dashboard/server/services/analytics/`

```javascript
AnalyticsRepository
  ├── getDailyUsers(params)
  ├── getMonthlyUsers(params)
  ├── getNewUsers(params)
  ├── getRetention(params)      // combined D1 + D7
  ├── getCountries(params)
  ├── getTopEvents(params)
  ├── getPlatformBreakdown(params)
  ├── getKpi(params)
  └── getExecutive(params)      // consolidated endpoint
```

No route executes raw SQL directly.

### 4. Caching

| Layer | Technology | TTL |
|-------|-----------|-----|
| Server | Redis (preferred) or in-memory | 1–24h per metric |
| Client | TanStack Query | Matches server staleTime |

Env vars:
```env
REDIS_URL=redis://localhost:6379
BQ_SUMMARY_DATASET=analytics_summary
USE_SUMMARY_TABLES=true
```

### 5. API endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/kpi` | Executive KPI cards |
| `POST /api/dashboard/executive` | All metrics in one call |
| `POST /api/query/dashboard/:name` | Per-metric (backward compatible) |
| `GET /api/dashboard/status` | Freshness + intraday detection |
| `GET /api/health` | Cache, BQ, bytes today |

### 6. Frontend

| Tab | Queries on open | Cached |
|-----|----------------|--------|
| Executive | 1 (KPI) | 24h |
| Engagement | DAU + MAU | 24h |
| Retention | D1 + D7 | 24h |
| Acquisition | 3 metrics | 24h |
| Features | Top events | 1h |

- **No polling** when daily export only — shows "Last Updated"
- **10-minute refresh** when intraday tables detected

---

## Refresh Strategy

| Mode | Schedule | Dashboard behavior |
|------|----------|-------------------|
| Daily export (default) | Scheduled queries @ 08:00 UTC | Static until next day; show last refresh |
| Intraday streaming | Scheduled queries every 4–6h | Auto-refresh every 10 min |

Manual refresh:
```bash
cd banknote-analytics-dashboard
npm run refresh-summaries          # legacy path via views
./scripts/deploy-scheduled-summaries.sh  # direct from events_*
```

---

## Cost Estimates

| Scenario | Monthly BigQuery cost |
|----------|----------------------|
| **Optimized** (summary + cache, 10 users) | ~$2–5 |
| **Unoptimized** (raw views, 10 users) | ~$100–300 |
| **Scheduled refresh only** | ~$2–3 (15 GB/day × 30) |

See [bigquery-cost-audit.md](./bigquery-cost-audit.md) and [cost-monitoring.md](./cost-monitoring.md).

---

## Scaling Strategy

| Users | Action |
|-------|--------|
| 1–50 | In-memory cache sufficient |
| 50–500 | Enable Redis (`REDIS_URL`) |
| 500+ | Redis + CDN for static assets; consider read replicas via materialized views |
| High traffic | Increase cache TTL; pre-warm `/api/dashboard/executive` after scheduled refresh |

BigQuery scales automatically — cost is driven by **bytes scanned**, not user count, when cache + summaries are used.

---

## Intraday Support

Server detects `events_intraday_*` via `INFORMATION_SCHEMA.TABLES`.

- If present: status endpoint reports `intradayEnabled: true`; client polls every 10 min
- If absent: no polling; daily refresh only
- Scheduled SQL: uncomment `UNION ALL` block in `daily_active_users.sql`

---

## File Map

```
bigdata/
├── sql/
│   ├── scheduled/           ← BigQuery scheduled queries → analytics_summary
│   ├── dashboard/summary/   ← Dashboard read queries (summary only)
│   └── 01–07_v_*.sql        ← Views (refresh job source, not dashboard)
├── banknote-analytics-dashboard/
│   ├── server/
│   │   ├── cache/           ← Redis + memory
│   │   ├── services/analytics/  ← Repository
│   │   └── routes/          ← HTTP handlers
│   └── src/hooks/useAnalytics.ts  ← TanStack Query
└── docs/
    ├── bigquery-cost-audit.md
    ├── cost-monitoring.md
    ├── production-architecture.md  ← this file
    └── scheduled-summaries-deployment.md
```

---

## Definition of Done

- [x] Dashboard works with all existing tabs
- [x] No dashboard query scans raw `events_*`
- [x] Cache implemented (Redis + memory fallback)
- [x] Summary table SQL generated (`analytics_summary`)
- [x] Repository layer — no SQL in routes
- [x] Consolidated `/api/dashboard/executive`
- [x] Intraday auto-detection
- [x] TanStack Query on frontend
- [x] Last Updated / no wasteful polling
- [x] Monitoring endpoints
- [x] Documentation complete
- [ ] **Deploy** scheduled queries in GCP (ops step)
- [ ] **Grant** SA permissions on `analytics_summary`
