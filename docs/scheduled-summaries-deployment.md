# Scheduled Summary Tables — Deployment Guide

## Overview

Dashboard queries read from the **`analytics_summary`** dataset — never from raw `events_*`.

Scheduled BigQuery queries populate summary tables once per day after the Firebase export lands (~08:00 UTC).

## Prerequisites

1. GCP project: `banknote-app-4f3fd`
2. Raw dataset: `analytics_488476338` (Firebase export)
3. Service account with:
   - `bigquery.datasets.create` (one-time, for `analytics_summary`)
   - `bigquery.tables.create`, `bigquery.tables.updateData`
   - `bigquery.jobs.create`

## Step 1 — Create dataset

```bash
bq mk --dataset --location=US banknote-app-4f3fd:analytics_summary
```

Or in Console: BigQuery → Create dataset → `analytics_summary` → US.

## Step 2 — Deploy scheduled queries

SQL files: `sql/scheduled/`

| File | Target table | Schedule (UTC) | Est. scan |
|------|-------------|----------------|-----------|
| `daily_active_users.sql` | `daily_active_users` | 08:00 daily | 1–5 GB |
| `monthly_active_users.sql` | `monthly_active_users` | 08:15 daily | 1–5 GB |
| `daily_new_users.sql` | `daily_new_users` | 08:30 daily | 2–8 GB |
| `daily_retention.sql` | `daily_retention` | 08:45 daily | 3–10 GB |
| `country_metrics.sql` | `country_metrics` | 09:00 daily | KB |
| `platform_metrics.sql` | `platform_metrics` | 09:05 daily | KB |
| `top_events.sql` | `top_events` | 09:10 daily | 1–3 GB |

### Console setup (each file)

1. BigQuery → **Scheduled queries** → **Create scheduled query**
2. Paste SQL from file; replace `{PROJECT}` → `banknote-app-4f3fd`, `{DATASET}` → `analytics_488476338`
3. Schedule: daily at listed time
4. Destination: none (SQL writes via INSERT)
5. Service account: analytics scheduler SA

### CLI one-time manual run

```bash
PROJECT=banknote-app-4f3fd DATASET=analytics_488476338 ./scripts/deploy-scheduled-summaries.sh
```

## Step 3 — Intraday support

If Firebase streaming export is enabled (`events_intraday_*` tables exist):

1. Uncomment the `UNION ALL` block in `daily_active_users.sql`
2. Re-run scheduled query or increase frequency to every 4–6 hours
3. Dashboard auto-detects intraday via `/api/dashboard/status`

## Step 4 — Verify

```bash
bq query --use_legacy_sql=false \
  'SELECT MAX(refreshed_at) FROM `banknote-app-4f3fd.analytics_summary.daily_active_users`'
```

Dashboard health: `GET http://localhost:3001/api/dashboard/status`

## Cost notes

- **Scheduled queries** scan raw events once/day (~5–20 GB total)
- **Dashboard queries** scan summary tables only (~1–50 MB per request)
- **Express cache** (24h TTL) reduces repeat scans to zero

## Environment variables

```env
GCP_PROJECT=banknote-app-4f3fd
BQ_DATASET=analytics_488476338
BQ_SUMMARY_DATASET=analytics_summary
USE_SUMMARY_TABLES=true
REDIS_URL=redis://localhost:6379   # optional
CACHE_TTL_MS=86400000              # override default per-metric TTL
```
