# How Banknote vs Coinzy compare works

## Two separate datasets

| App | GCP project | BigQuery dataset | Credentials |
|-----|-------------|------------------|-------------|
| **Banknote** (blue) | `banknote-app-4f3fd` | `analytics_488476338` | `secrets/bigquery-banknote-sa.json` |
| **Coinzy** (green) | `coinzy-26a4d` | `analytics_487601380` | `secrets/coinzy-analytics-dashboard-sa.json` |

They are **not** split by `app_name` inside one table. Each Firebase project exports to its own dataset.

## Same query shape

For each product we run the **same SQL template** (`sql/dashboard/raw/16_product_daily_signals.sql`):

- DAU = opened the app (`app_open_dau`); Notification DAU and Any-event DAU are separate columns
- Installs, identify success, quota hit, paywall conversion
- Funnel (open → success), catalogue, marketplace

Only `{PROJECT}` / `{DATASET}` change.

## Compare screen flow

1. User opens **Compare** (or sidebar Compare).
2. API receives `product: "compare"`.
3. Server runs the signals query **in parallel** on Banknote and Coinzy.
4. Rows are tagged `product = "Banknote"` or `"Coinzy"`.
5. UI pivots by date and draws two series:
  - Banknote → `#4f8cff` (blue)
  - Coinzy → `#34d399` (green)
6. DAU chart is **opened the app**. Notification display is a supporting chart, not mixed into DAU.

## Single-app mode

- Sidebar **Banknote** → all metric tabs query Banknote only.
- Sidebar **Coinzy** → same metric tabs query Coinzy only (raw `events_*` until views exist).

## Coinzy note (read-only SA)

The Coinzy service account is **Data Viewer** (cannot create views).  
Dashboard uses **raw event SQL** for Coinzy (`COINZY_PREFER_RAW=true`).  
When someone grants Data Editor, deploy views with `./scripts/deploy-product-views.sh` and set `COINZY_PREFER_RAW=false`.
