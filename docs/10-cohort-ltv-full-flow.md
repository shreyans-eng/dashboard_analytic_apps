# Cohort LTV — MongoDB architecture

**BigQuery = source of truth (read-only). MongoDB = precomputed LTV read model. Dashboard never scans events_* on normal requests.**

```text
Firebase
   ↓
BigQuery events_*     ← READ ONLY
   ↓  once / 24h   npm run refresh-ltv:mongo
MongoDB cohort_ltv    ← aggregated only
   ↓
LTV API (+ filters, pagination)
   ↓
Redis/memory cache (optional)
   ↓
React Explorer / Compare
```

No `analytics_summary`. No BigQuery `cohort_ltv` table. No `bigquery.tables.create`.

## Separation

- Banknote SA reads Banknote `events_*` → Mongo docs `product: "banknote"`
- Coinzy SA reads Coinzy `events_*` → Mongo docs `product: "coinzy"`
- Every query filters by `product`

## Indexes

```text
unique: product + cohort_date + country + install_channel + platform
product + cohort_date
product + country + install_channel + cohort_date
```

## Refresh

```bash
PRODUCTS=banknote,coinzy DAYS=30 LTV_DAYS=210 npm run refresh-ltv:mongo
```

Idempotent window replace. Schedule daily after Firebase export (~08:00–10:00 UTC).

## Verify

1. Refresh prints MB scanned (BQ once).
2. Mongo has docs per product.
3. API `source: "mongodb"`, `bytesProcessed: 0`.
4. Changing filters does not create BigQuery jobs.
5. Empty Mongo without `LTV_ALLOW_RAW_FALLBACK=true` returns a clear error (no silent raw scan).
