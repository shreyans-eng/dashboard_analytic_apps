# Production Analytics Architecture

Banknote AI uses a **summary-table** pattern so the React dashboard never scans raw Firebase `events_*` tables on every page load.

## Data flow

```
Firebase Analytics
       ↓ (daily export, ~once/day)
events_YYYYMMDD          ← raw events (historical analysis only)
       ↓ (views — used only by refresh job)
v_events_normalized, v_daily_active_users, …
       ↓ (daily MERGE, scripts/refresh-summaries.js)
summary_daily_dau, summary_monthly_mau, summary_retention, …
       ↓ (cheap partitioned scans)
Express API + in-memory cache (1h TTL)
       ↓
React dashboard (lazy per tab)
```

## Summary tables

| Table | Metrics | Partition |
|-------|---------|-----------|
| `summary_daily_dau` | DAU by date/platform/country | `event_date` |
| `summary_monthly_mau` | MAU by month/platform/country | `activity_month` |
| `summary_new_users` | New users by cohort date | `cohort_date` |
| `summary_retention` | D1/D7 cohort retention | `cohort_date` |
| `summary_countries` | DAU + new users by country | `event_date` |
| `summary_platform` | Users by platform | `event_date` |
| `summary_top_events` | Event counts | `event_date` |

DDL + MERGE SQL: `sql/summary/`

Dashboard queries (read summary only): `sql/dashboard/summary/`

## Daily refresh

After Firebase lands new data in BigQuery (typically morning UTC):

```bash
cd banknote-analytics-dashboard
npm run refresh-summaries
```

Or trigger via API (clears Express cache first):

```bash
curl -X POST http://localhost:3001/api/admin/refresh-summaries
```

**Cron example** (run at 08:00 UTC daily):

```cron
0 8 * * * cd /path/to/bigdata/banknote-analytics-dashboard && npm run refresh-summaries >> /var/log/banknote-summary-refresh.log 2>&1
```

For fresher data, enable Firebase **streaming export** to `events_intraday_*` and run refresh every 4–6 hours (adjust MERGE window in `sql/summary/refresh_*.sql`).

## Express caching

- Default TTL: **1 hour** (`CACHE_TTL_MS` env var)
- Cached endpoints: `/api/kpi`, `/api/query/dashboard/:name`
- Clear cache: `POST /api/cache/clear`
- Stats: `GET /api/cache/stats`

Set `USE_SUMMARY_TABLES=false` to fall back to view queries (development only — expensive).

## Dashboard lazy loading

Each sidebar tab runs **only its own queries** when opened:

| Tab | Queries on load |
|-----|-----------------|
| Executive | 1 KPI call (cached) |
| Engagement | DAU + MAU |
| Retention | D1 + D7 |
| Acquisition | New users + countries + platform |
| Feature Usage | Top events |

Navigating away unmounts the page — no background queries.

## BigQuery cost controls

### 1. Monitor bytes per query

The refresh script logs MB scanned per step. In production, log `bytesProcessed` from the Express API (returned on `/api/query/run`).

BigQuery console → **Query history** → sort by bytes processed.

### 2. Set a billing budget + alert

1. [Google Cloud Console](https://console.cloud.google.com/billing) → **Billing** → **Budgets & alerts**
2. Create budget for project `banknote-app-4f3fd`
3. Set monthly target (e.g. **$25** for analytics)
4. Alert thresholds: **50%, 90%, 100%**
5. Add email notification

### 3. BigQuery quotas (optional)

IAM → **Quotas** → filter `BigQuery` → set **Query usage per day** cap if needed.

### 4. Table expiration (raw events)

Raw `events_*` tables can grow indefinitely. Consider a **partition expiration** policy on intraday tables, or export old partitions to Cloud Storage for cold storage.

Summary tables are small (90-day window) and cheap to query.

## First-time setup

```bash
# 1. Deploy views (if not already)
PROJECT=banknote-app-4f3fd DATASET=analytics_488476338 ./deploy-views.sh

# 2. Create + populate summary tables
cd banknote-analytics-dashboard
npm run refresh-summaries

# 3. Start dashboard
npm run dev
```

Verify `/api/health` shows `useSummaryTables: true` and KPI returns data.
