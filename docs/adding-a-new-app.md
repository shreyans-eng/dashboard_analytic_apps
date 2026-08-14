# Adding a new app to the analytics dashboard

Banknote and Coinzy are already registered. To add another product (same 10 MVP KPIs, separate dataset, own switcher tab + Compare):

## 1. Env

In `banknote-analytics-dashboard/.env`:

```bash
PRODUCTS=banknote,coinzy,stampzy

PRODUCT_STAMPZY_LABEL=Stampzy
PRODUCT_STAMPZY_GCP_PROJECT=your-gcp-project
PRODUCT_STAMPZY_BQ_DATASET=analytics_XXXXXXXXX
PRODUCT_STAMPZY_BQ_SUMMARY_DATASET=analytics_summary
PRODUCT_STAMPZY_GOOGLE_APPLICATION_CREDENTIALS=../secrets/stampzy-sa.json
PRODUCT_STAMPZY_PREFER_RAW=true          # true if SA cannot create views
PRODUCT_STAMPZY_USE_SUMMARY=false
PRODUCT_STAMPZY_COLOR=#a78bfa
```

Legacy `GCP_*` / `COINZY_*` keys still work for Banknote and Coinzy.

## 2. Credentials

Put a BigQuery service account JSON under `secrets/` (gitignored) and point the path above at it. Minimum: **BigQuery Data Viewer** on the analytics dataset (raw `events_*` path). For product views: **Data Editor** + run `./scripts/deploy-product-views.sh` against that project/dataset.

## 3. Optional UI metadata

In `src/lib/product.tsx` → `PRODUCT_CATALOG`, add:

```ts
stampzy: {
  brand: 'Stampzy',
  shortName: 'Stampzy',
  tagline: '…',
  entity: 'stamp',
  entityIdParam: 'stamp_id',
  ahaAction: 'first successful stamp scan',
  journey: [...SHARED_JOURNEY],
  appNameFilter: 'Stampzy',
},
```

Without this, the dashboard still works using the env `LABEL`.

## 4. Restart

```bash
cd banknote-analytics-dashboard && npm run dev
```

You should see the new app in the sidebar switcher. Select it to view **MVP KPIs (10)** for that app alone, or **Compare** for all registered apps.

## 5. What is shared vs per-app

| Shared | Per-app |
|--------|---------|
| Journey + 10 MVP definitions | GCP project / dataset |
| SQL under `sql/dashboard/product/01`–`10` | Credentials |
| Raw signals `sql/dashboard/raw/16_*.sql` | `preferRaw` / summary flags |
| Dashboard tabs | Chart color / label |

Event contract (Identify, quota, paywall, catalogue, marketplace) should match `docs/mvp-kpi-query-guide.md`.
