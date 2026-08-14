# BigQuery Cost Monitoring

How to monitor, alert on, and control BigQuery spending for Banknote AI analytics.

---

## 1. Google Cloud Budget + Alerts

### Create a budget

1. Open [Google Cloud Billing → Budgets & alerts](https://console.cloud.google.com/billing/budgets)
2. Select billing account for `banknote-app-4f3fd`
3. **Create budget**
   - Name: `Banknote Analytics BigQuery`
   - Scope: Project `banknote-app-4f3fd`
   - Amount: e.g. **$25/month** (adjust to your target)
4. **Set alert thresholds:**
   - **25%** — early warning
   - **50%** — review query patterns
   - **75%** — investigate immediately
   - **100%** — budget exceeded
5. Add email recipients (your team + billing admin)

### Filter to BigQuery only (optional)

In budget filters, set **Service = BigQuery** so alerts reflect analytics query cost, not Compute/App Engine.

---

## 2. Monitor bytes processed

### Dashboard API (runtime)

```bash
curl http://localhost:3001/api/cache/stats
```

Returns:
```json
{
  "backend": "memory",
  "metrics": {
    "date": "2026-08-06",
    "bytesProcessedToday": 52428800,
    "gbProcessedToday": 0.0524,
    "queryCountToday": 12
  }
}
```

### BigQuery Console

1. BigQuery → **Query history**
2. Sort by **Bytes processed** (descending)
3. Filter by user/service account
4. Look for queries hitting `events_*` — these should only appear in **scheduled queries**, not dashboard API

### Cloud Monitoring (advanced)

Create a log-based metric from BigQuery audit logs:

```
resource.type="bigquery_project"
protoPayload.serviceData.jobCompletedEvent.job.jobStatistics.totalProcessedBytes
```

Chart in Cloud Monitoring dashboard with alert if daily bytes > threshold.

---

## 3. Inspect expensive queries

### Top offenders to watch

| Query pattern | Expected? | Action if seen from dashboard |
|---------------|-----------|------------------------------|
| `FROM events_*` | Scheduled queries only | **Bug** — check `USE_SUMMARY_TABLES` |
| `FROM v_events_normalized` | Refresh job / SQL Editor | Move to scheduled query |
| `FROM analytics_summary.*` | Dashboard API | ✅ Normal (~MB) |
| `SELECT *` | Never | Fix SQL — select columns only |

### CLI: last 10 expensive jobs

```bash
bq ls -j --max_results=10 --project_id=banknote-app-4f3fd --format=prettyjson \
  | jq '.[] | {id: .jobReference.jobId, bytes: .statistics.query.totalBytesProcessed}'
```

---

## 4. Cost protection rules (enforced in code)

1. **Dashboard never scans raw events** — reads `analytics_summary.*` only
2. **Server cache** — 24h TTL for daily metrics; repeat requests = 0 bytes
3. **TanStack Query** — client deduplication; no duplicate in-flight requests
4. **Scheduled aggregation** — raw scan once/day (~15 GB) vs per-user (~5 GB × N)
5. **No polling on daily export** — "Last Updated" label instead of minute refresh
6. **Intraday mode** — 10-minute refresh max (never faster than 5 min)

---

## 5. Recommended thresholds

| Alert | Threshold | Action |
|-------|-----------|--------|
| Budget 25% | $6.25 of $25 | Review scheduled query schedule |
| Budget 50% | $12.50 | Check for runaway SQL Editor queries |
| Budget 75% | $18.75 | Disable legacy fallback; verify cache |
| Daily bytes (API) | > 1 GB/day | Cache miss storm — check Redis |
| Scheduled job failure | Any | Summary tables stale — dashboard may fallback to views |

---

## 6. Monthly review checklist

- [ ] BigQuery query history — zero `events_*` from dashboard SA
- [ ] Budget alerts configured at 25/50/75/100%
- [ ] `analytics_summary` tables have recent `refreshed_at`
- [ ] `/api/dashboard/status` shows `lastRefresh` within 48h
- [ ] Cache hit rate acceptable (check logs for `cached: true`)
- [ ] No unexpected growth in `events_*` storage

---

## 7. Useful links

- [BigQuery pricing](https://cloud.google.com/bigquery/pricing)
- [Creating budgets](https://cloud.google.com/billing/docs/how-to/budgets)
- [Query execution details](https://cloud.google.com/bigquery/docs/query-overview)
- Internal: [bigquery-cost-audit.md](./bigquery-cost-audit.md)
- Internal: [production-architecture.md](./production-architecture.md)
