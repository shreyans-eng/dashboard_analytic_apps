# Cohort LTV — MongoDB read model

LTV-30 / LTV-90 / LTV-180 by **install cohort date × country × Organic / Paid / Direct**.

```text
Firebase → BigQuery events_* (READ ONLY)
        → daily refresh (SELECT only)
        → MongoDB collection `cohort_ltv`
        → API filters + pagination
        → optional Redis/memory cache
        → Explorer /ltv + Compare
```

| Product | BigQuery source (read) | MongoDB |
|---------|------------------------|---------|
| Banknote | `banknote-app-4f3fd.analytics_488476338.events_*` | `cohort_ltv` docs with `product: "banknote"` |
| Coinzy | `coinzy-26a4d.analytics_487601380.events_*` | `cohort_ltv` docs with `product: "coinzy"` |

API `source: "mongodb"`. Normal requests **do not** query BigQuery.

## Formula (unchanged)

```text
LTV-N = revenue in the N days after install ÷ installs in the cohort
```

Immature windows → NULL. Windows: 30 / 90 / 180 only.

## Daily refresh

```bash
cd banknote-analytics-dashboard
PRODUCTS=banknote,coinzy DAYS=30 LTV_DAYS=210 npm run refresh-ltv:mongo
```

- Scans only the cohort window (expanded by `LTV_DAYS`, default 210) through `cohort_end + 180` purchase days.
- Upserts by deleting the product’s window then inserting (idempotent).
- Requires `MONGODB_URI` — **no** BigQuery table create permission.

## API filters & pagination

| Param | Role |
|-------|------|
| `start_date` / `end_date` | Cohort date range |
| `country` | Exact country |
| `install_channel` | Organic \| Paid \| Direct |
| `platform` | Optional |
| `search` | Substring on country / channel / date |
| `page` / `page_size` | Server pagination (default 25) |
| `paginate=false` | Return all rows (Compare) |

Response includes `rows`, `total`, `page`, `page_size`, `daily`, `by_channel`, `totals`, `countries`, `source: "mongodb"`.

## Emergency BigQuery

| Env | Default | Meaning |
|-----|---------|---------|
| `LTV_FORCE_RAW` | off | Always hit events_* (debug) |
| `LTV_ALLOW_RAW_FALLBACK` | **off** | If Mongo empty for product, allow one raw scan only when set to `true` |

## SQL / code

| Piece | Path |
|-------|------|
| BQ SELECT (refresh) | `sql/scheduled/cohort_ltv_mongo.sql` |
| Emergency raw | `sql/dashboard/raw/10_cohort_ltv.sql` |
| Mongo store | `server/services/analytics/cohort-ltv-mongo.js` |
| Refresh script | `scripts/refresh-cohort-ltv-mongo.js` |

See [10-cohort-ltv-full-flow.md](./10-cohort-ltv-full-flow.md).
