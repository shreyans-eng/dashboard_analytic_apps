# Queries used by each dashboard tab

Simple map: **sidebar tab → SQL file (or code) the API runs**.

PDF: [QUERIES-BY-TAB.pdf](./QUERIES-BY-TAB.pdf) — **full SQL** for each tab (not just file names). Regenerate with `node scripts/render-queries-pdf.js`.

Companion to [EVENTS-BY-TAB.md](./EVENTS-BY-TAB.md) (events) and [PROJECT.md](./PROJECT.md) (architecture).

Paths are under `sql/` unless noted. `{app}` = `banknote` or `coinzy`. If `dashboard/product/{app}/file.sql` exists, that file wins over the shared `dashboard/product/file.sql`.

---

## How the API picks a file

```text
1. Summary   analytics_summary.*     cheap (after daily refresh)
2. Product   sql/dashboard/product/{app}/ then product/
3. View      sql/dashboard/*.sql     reads v_*
4. Raw       sql/dashboard/raw/      reads events_*
```

Country or platform filter **skips summary** (those tables are date-only). `PREFER_RAW=true` skips summary and views.

Home and Product Analytics **do not query BigQuery**.

---

## Compare Apps · Health report

| Tab | API name | Query |
|-----|----------|--------|
| Compare Apps | `compare-daily` + `compare-summary` | Same SQL, run **once per app**, then tagged |
| Health report (combined) | same | same |
| Health report (one app) | extra | KPI + `user-mix` + MVP 2 + Identify / Paywall / Expert funnels |

**Signals SQL (Compare + most MVP rates):**

| Step | File | Reads |
|------|------|--------|
| Daily refresh | `scheduled/product_daily_signals.sql` | `events_*` → writes `analytics_summary.product_daily_signals` |
| Dashboard (cheap) | `dashboard/summary/16_product_daily_signals.sql` | that summary table |
| Fallback Banknote | `dashboard/raw/16_product_daily_signals.sql` | `events_*` |
| Fallback Coinzy | `dashboard/product/coinzy/16_product_daily_signals.sql` | `events_*` |

Compare LTV = Mongo `cohort_ltv` (`compare-ltv`). Compare subscriptions = `dashboard/raw/18_subscription_tiers.sql` per app.

Filter country dropdown (every page with filters): `country-list` → `dashboard/summary/04_country_list.sql` → raw `04_country_list.sql`.

---

## MVP KPIs (10)

Most of 1, 3–5, 7–10 first try **product_daily_signals** (summary, else raw/Coinzy override). If that is empty or missing, they run the product SQL below.

### 1. DAU (opened app)

| App | If signals miss | Reads |
|-----|-----------------|--------|
| Banknote | `dashboard/product/01_dau.sql` | `events_*` |
| Coinzy | `dashboard/product/coinzy/01_dau.sql` | `events_*` |

### 2. Install → first scan

**Never** uses product_daily_signals. Always dedicated SQL, join on `user_pseudo_id`.

| App | File | Fallback |
|-----|------|----------|
| Banknote | `dashboard/product/banknote/02_time_to_first_scan.sql` | `dashboard/product/02_time_to_first_scan.sql` → `dashboard/raw/02_time_to_first_scan.sql` |
| Coinzy | `dashboard/product/coinzy/02_time_to_first_scan.sql` | same shared / raw |

View (not used by this tab unless you deploy it for other tools): `14_v_time_to_first_scan.sql`.

### 3. Identify success

| App | Product SQL | Reads |
|-----|-------------|--------|
| Banknote | `dashboard/product/03_identify_success_rate.sql` | view `v_identify_metrics` (`08_v_identify_metrics.sql`) |
| Coinzy | `dashboard/product/coinzy/03_identify_success_rate.sql` | `events_*` |

### 4. Quota hit

| App | Product SQL | Reads |
|-----|-------------|--------|
| Banknote | `dashboard/product/banknote/04_quota_hit_rate.sql` | `events_*` |
| Coinzy | `dashboard/product/coinzy/04_quota_hit_rate.sql` | `events_*` |

Shared fallback: `dashboard/product/04_quota_hit_rate.sql` → `v_identify_metrics`.

### 5. Paywall → purchase

| App | Product SQL | Reads |
|-----|-------------|--------|
| Banknote | `dashboard/product/05_paywall_conversion.sql` | view `v_subscription_metrics` (`07_v_subscription_metrics.sql`) |
| Coinzy | `dashboard/product/coinzy/05_paywall_conversion.sql` | `events_*` |

### 6. D1 / D7 retention

Live path is **raw** `dashboard/raw/09_retention.sql` (and `05` / `06` for the merge fallback). Return = `session_start` / `App_open` / `first_open`. The `daily_retention` summary is **not** used until it is rebuilt with the same definition (it used to count any event, including push).

| Order | File | Reads |
|-------|------|--------|
| 1 | `dashboard/raw/09_retention.sql` | `events_*` (DAU events only) |
| or | merge `d1` + `d7` | `raw/05_d1_retention.sql` / `raw/06_d7_retention.sql` |

### 7. Scans / user

**Never** uses `product_daily_signals` (needs user-day grain for percentiles).

| App | Product SQL | Reads |
|-----|-------------|--------|
| Banknote | `dashboard/product/07_scans_per_user.sql` | `v_daily_active_users` (`02_v_daily_active_users.sql`) |
| Coinzy | `dashboard/product/coinzy/07_scans_per_user.sql` | `events_*` |

Columns: `scans_per_dau` (mean including zeros), `scans_per_scanning_user`, `scans_p10` / `p25` / `p50` / `p75` / `p90` / `p95` / `p99` among all DAU including 0 scans.

### 8. Identify funnel (open → success)

| App | Product SQL | Reads |
|-----|-------------|--------|
| Banknote | `dashboard/product/08_identify_funnel_conversion.sql` | `v_identify_metrics` |
| Coinzy | `dashboard/product/coinzy/08_identify_funnel_conversion.sql` | `events_*` |

This tab is the **rate chart**. Step drop-off is the Identify **funnel** pages, not this SQL.

### 9. Catalogue

| App | Product SQL | Reads |
|-----|-------------|--------|
| Banknote | `dashboard/product/09_catalogue_engagement.sql` | `v_engagement_metrics` |
| Coinzy | `dashboard/product/coinzy/09_catalogue_engagement.sql` | `events_*` |

### 10. Marketplace

| App | Product SQL | Reads |
|-----|-------------|--------|
| Banknote | `dashboard/product/10_marketplace_engagement.sql` | `v_engagement_metrics` |
| Coinzy | `dashboard/product/coinzy/10_marketplace_engagement.sql` | `events_*` |

---

## Funnels

**Not a file in `sql/`.** The API builds one `SELECT` in `banknote-analytics-dashboard/server/services/analytics/funnel-registry.js` (`buildFunnelSql`) and scans `events_*` once.

| Tab | Funnel id | Event lists live in |
|-----|-----------|---------------------|
| Identify (all) | `identify` | `FUNNELS.identify` |
| Scan · bottom nav | `identify-nav` | cohort = `Identify_bottom_nav` (Coinzy minus `Identify_home`) |
| Scan · home / banner | `identify-home` | cohort = `Identify_home` |
| Scan · camera | `identify-camera` | cohort = shutter (`Photo_clicked` / `photo_clicked_*`) |
| Scan · gallery | `identify-gallery` | cohort = gallery; Coinzy excludes `Photo_clicked` |
| Private collection | `collection` | session start, then collection steps only |
| Global catalogue | `global` | session start, then catalogue steps only |
| Marketplace | `marketplace` | market steps only (no Feed) |
| Feed | `feed` | feed steps only |
| Paywall | `paywall` | `BANKNOTE_PAYWALL` / `COINZY_PAYWALL` + pack mix (`pack_name`) |
| Onboarding | `onboarding` | first-run screens through completion |
| Onboarding → subs | `paywall-onboarding` | onboarding cohort, then pack / CTA / confirm |
| Expert evaluation | `expert` | `COINZY_EXPERT` (Coinzy only) |

Copies under `dashboard/product/{app}/*_funnel_steps.sql` and `*_event_volume.sql` are for the **SQL Editor** only. The live funnel tabs do not run them.

---

## Event catalog

Static list from `event-catalog.js` (funnel-registry + DAU / KPI extras). No BigQuery. Dashboard tab **Event catalog**. CSV download is client-side.

## Event inventory

| Action | Query |
|--------|--------|
| List events | Prefer `analytics_summary.top_events` via `buildEventInventoryFromSummarySql` |
| If summary missing | `buildEventInventorySql` on `events_*` |
| Click one event | `buildEventDailySql` + `buildEventParamsSql` (params UNNEST `event_params`) |

Code: same `funnel-registry.js`. Refresh that fills summary: `scheduled/event_inventory_daily.sql` / `scheduled/top_events.sql`.

---

## Explorer

| Tab | API name | Summary | View (legacy) | Raw |
|-----|----------|---------|---------------|-----|
| Daily Active Users | `dau` | `dashboard/summary/01_dau.sql` → `product_daily_signals` | skipped for DAU | `dashboard/raw/01_dau.sql` |
| Unique vs repeat | `user-mix` | — | — | `dashboard/raw/19_user_mix.sql` |
| Monthly Active Users | `mau` | `summary/02_mau.sql` | `dashboard/02_monthly_active_users.sql` → `v_monthly_active_users` | `raw/02_mau.sql` |
| New Users | `new-users` | `summary/03_new_users.sql` | `dashboard/03_new_users.sql` | `raw/03_new_users.sql` |
| Installs + time used | `install-day-usage` | — | — | `raw/20_install_day_usage.sql` |
| D0 / D1 percentiles | `d0-d1-percentiles` | — | — | `raw/23_install_d0_d1_percentiles.sql` |
| Scan limits | `scan-limits` | — | — | `raw/21_scan_limits.sql` |
| Free-scan success quota | `free-scan-quota` | — | — | `product/coinzy/22_free_scan_success_quota.sql` (Coinzy only) |
| D1 Retention | `d1` | `summary/05_d1_retention.sql` | `dashboard/05_d1_retention.sql` | `raw/05_d1_retention.sql` |
| D7 Retention | `d7` | `summary/06_d7_retention.sql` | `dashboard/06_d7_retention.sql` | `raw/06_d7_retention.sql` |
| Top Countries | `countries` | `summary/04_countries.sql` | `dashboard/04_top_countries.sql` | `raw/04_countries.sql` |
| Platform | `platform` | `summary/08_platform.sql` | `dashboard/08_platform_breakdown.sql` | `raw/08_platform.sql` |
| Top Events | `events` | `summary/07_top_events.sql` | `dashboard/07_top_events.sql` | `raw/07_top_events.sql` |
| Cohort LTV | `ltv` | **Mongo** `cohort_ltv` | — | emergency only: `raw/10_cohort_ltv.sql` |

LTV refresh (writes Mongo, does not serve the tab): `scheduled/cohort_ltv_mongo.sql`.

Explorer DAU with a country/platform filter **always** uses raw `01_dau.sql` (summary has no that grain).

---

## SQL Editor · Admin

| Tab | Query |
|-----|--------|
| SQL Editor | Whatever you paste, or a file loaded from `sql/` (including `*_funnel_steps.sql`). Does **not** change KPI definitions. |
| Users & access | Mongo `users` — no BigQuery |

---

## Views the product SQL can read

Deployed by `scripts/deploy-product-views.sh` / `deploy-product-metrics.sh`. Built from `events_*` via `01_v_events_normalized.sql`.

| View file | View name | Used by |
|-----------|-----------|---------|
| `01_v_events_normalized.sql` | `v_events_normalized` | other views |
| `02_v_daily_active_users.sql` | `v_daily_active_users` | engagement, retention |
| `03_v_monthly_active_users.sql` | `v_monthly_active_users` | Explorer MAU (view path) |
| `04_v_new_users.sql` | `v_new_users` | retention |
| `05_v_country_metrics.sql` | `v_country_metrics` | Explorer countries (view path) |
| `06_v_retention_cohorts.sql` | `v_retention_cohorts` | MVP 6 / Explorer D1 D7 (view path) |
| `07_v_subscription_metrics.sql` | `v_subscription_metrics` | Banknote MVP 5 |
| `08_v_identify_metrics.sql` | `v_identify_metrics` | Banknote MVP 3, 8 (and shared 4) |
| `10_v_engagement_metrics.sql` | `v_engagement_metrics` | Banknote MVP 7, 9, 10 |
| `14_v_time_to_first_scan.sql` | `v_time_to_first_scan` | not the live MVP 2 tab |

Coinzy product SQL mostly **skips views** and reads `events_*` directly.

---

## Daily refresh (fills summaries)

| Script | SQL | Writes |
|--------|-----|--------|
| `npm run refresh-summaries:product` | `scheduled/daily_active_users.sql` | `analytics_summary.daily_active_users` |
| same | `scheduled/monthly_active_users.sql` | `monthly_active_users` |
| same | `scheduled/daily_new_users.sql` | `daily_new_users` |
| same | `scheduled/daily_retention.sql` | `daily_retention` |
| same | `scheduled/country_metrics.sql` | `country_metrics` |
| same | `scheduled/platform_metrics.sql` | `platform_metrics` |
| same | `scheduled/top_events.sql` | `top_events` |
| same | `scheduled/product_daily_signals.sql` | `product_daily_signals` |
| `npm run refresh-ltv:mongo` | `scheduled/cohort_ltv_mongo.sql` | Mongo `cohort_ltv` |

Dashboard tabs read those stores; they do not run the scheduled files on click.

---

## Quick lookup (tab → first file to open)

| Tab | Open this |
|-----|-----------|
| Compare / Health rollup | `dashboard/raw/16_product_daily_signals.sql` (+ Coinzy `product/coinzy/16_…`) |
| MVP 1 DAU | `product/01_dau.sql` |
| MVP 2 same-day scan | `product/{app}/02_time_to_first_scan.sql` |
| MVP 3 success | Banknote view `08_v_identify_metrics.sql` · Coinzy `product/coinzy/03_…` |
| MVP 4 quota | `product/{app}/04_quota_hit_rate.sql` |
| MVP 5 paywall | Banknote `07_v_subscription_metrics.sql` · Coinzy `product/coinzy/05_…` |
| MVP 6 / Explorer D1 D7 | `dashboard/raw/09_retention.sql` |
| MVP 7 Banknote | `product/07_scans_per_user.sql` → `v_daily_active_users` |
| MVP 7 Coinzy | `product/coinzy/07_scans_per_user.sql` |
| MVP 8–10 Banknote | `10_v_engagement_metrics.sql` |
| MVP 8–10 Coinzy | `product/coinzy/09` / `10` + `08_identify_funnel_conversion.sql` |
| Any funnel | `server/services/analytics/funnel-registry.js` |
| Event inventory | same file (`buildEventInventorySql`) |
| Explorer DAU | `dashboard/raw/01_dau.sql` |
| Unique vs repeat | `dashboard/raw/19_user_mix.sql` |
| Installs + time | `dashboard/raw/20_install_day_usage.sql` |
| D0 / D1 percentiles | `dashboard/raw/23_install_d0_d1_percentiles.sql` |
| Scan limits | `dashboard/raw/21_scan_limits.sql` |
| Free-scan success quota | `dashboard/product/coinzy/22_free_scan_success_quota.sql` |
| Cohort LTV | Mongo · emergency `dashboard/raw/10_cohort_ltv.sql` |
