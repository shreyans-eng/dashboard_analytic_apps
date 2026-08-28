# Analytics — Full guide: queries & events

Everything the dashboard uses for Banknote, Coinzy, and any future app registered via `PRODUCTS=`.

---

## 1. Projects & modes

| App | Project | Dataset | Dashboard mode |
|-----|---------|---------|----------------|
| Banknote | `banknote-app-4f3fd` | `analytics_488476338` | **Summary** → view → raw (`preferRaw=false`, `useSummary=true`) |
| Coinzy | `coinzy-26a4d` | `analytics_487601380` | **Summary** → view → raw (`preferRaw=false`, `useSummary=true`) |

Architecture: `docs/06-summary-architecture.md` · Discovery: `docs/05-discovery-report-summary-migration.md`

Identity: `COALESCE(real user_id, real event_params.user_id, user_pseudo_id)` — skip placeholders such as `anonymous`.  
Country: `COALESCE(event_params.country, geo.country)`  
Event base: strip `_android` / `_ios` suffix → `event_name_base`

**DAU (opened the app):** `session_start`, `App_open`, `first_open` (and `_android` / `_ios` variants).  
**Notification DAU:** `notification_display` plus related push events (`notification_receive`, `notification_interact`, …). Not mixed into DAU.  
**Any-event DAU:** distinct users with any Firebase event that day.

---

## 2. MVP KPI → query → events

| # | KPI | Banknote SQL (views) | Coinzy / fallback | Events used |
|---|-----|----------------------|-------------------|-------------|
| 1 | DAU | `product/01_dau.sql` from `events_*` | `raw/01_dau.sql` or signals `dau` (= `app_open_dau`) | `session_start` ∪ `App_open` ∪ `first_open` |
| 2 | Time to first scan | `product/02_*.sql` ← `v_time_to_first_scan` | **No raw fallback yet** (empty until views) | Cohort: `first_open`; success: `identification_done_success` |
| 3 | Identify success | `product/03_*.sql` ← `v_identify_metrics` | `raw/16` → `identification_success_rate` | `identification_done_success`, `identification_done_failure` |
| 4 | Quota hit | `product/04_*.sql` ← `v_identify_metrics` | `raw/16` → `free_quota_hit_rate` | `Identified_limit_reached`, `scan_quota_exhausted`, `limit_exceeded` |
| 5 | Paywall → purchase | `product/05_*.sql` ← `v_subscription_metrics` | `raw/16` → `paywall_to_confirm_rate` | `Subs_page`, `Subs_page_discount` → `Subs_confirm` |
| 6 | D1 / D7 retention | `product/06_*.sql` ← `v_retention_cohorts` | `raw/05`, `06`, `09_retention.sql` | Cohort `first_open`; return = any activity day+1/+7 |
| 7 | Scans / user | `product/07_*.sql` ← `v_engagement_metrics` | `raw/16` → `scans_per_dau` | `identification_done_success` ÷ DAU |
| 8 | Identify funnel | `product/08_*.sql` ← `v_identify_metrics` | `raw/16` → `open_to_success_rate` | See funnel table below. Step SQL: `product/banknote/08_*` · `product/coinzy/08_identify_funnel_steps.sql` |
| 9 | Catalogue | `product/09_*.sql` ← `v_engagement_metrics` | `raw/16` → `catalogue_open_rate` | **Both apps:** `Collection_screen` ∪ `Global_catalogue_screen`. Detail: Banknote `banknote_details_*` · Coinzy `Coin_details_*` |
| 10 | Marketplace | `product/10_*.sql` ← `v_engagement_metrics` | `raw/16` → `marketplace_engagement_rate` | `marketplace_screen`, `market_item_expolre`, `market_contact` / `market_contact_button` |

Dashboard API names: `mvp-dau`, `mvp-time-to-first-scan`, `mvp-identify-success`, `mvp-quota-hit`, `mvp-paywall`, `mvp-retention`, `mvp-scans-per-user`, `mvp-identify-funnel`, `mvp-catalogue`, `mvp-marketplace`.

Compare / Coinzy product rollup: **`sql/dashboard/raw/16_product_daily_signals.sql`** (run once per app, merge in API).

---

## 3. Identify funnel events (preferred + aliases)

| Step | Preferred | Also accepted |
|------|-----------|---------------|
| Open | `Identify_bottom_nav` ∪ `Identify_home` | `Identification_screen`, `Identify_open`, `Identify` |
| Camera OK | `camera_permission_granted` | `Camera_permission_granted` |
| Camera deny | `camera_permission_denied` | `camer_permission_denied` (Banknote typo) |
| Photo | `photo_clicked_1` / `photo_clicked_2` | `Photo_clicked`, `photo_captured` |
| Submit | `photos_submitted` ∪ `photo_submit_button` | `Identification_done` |
| Success | **`identification_done_success`** | `Identification_done_success` |
| Failure | **`identification_done_failure`** | `Identification_failed`, `Identification_unsuccessful` |

**Coinzy app path:** CameraScreen → crop (`photo_cropping_screen_*`) → submit → CoinAnalysisScreen success/failure.

---

## 4. Other event groups

| Area | Preferred events |
|------|------------------|
| Install | `first_open` |
| Quota | `Identified_limit_reached`, Coinzy: `free_scan_limit_exceeded`, `free_scan_blocked` |
| Paywall | `Subs_page`, `Subs_page_discount`. Confirm: Banknote `Subs_confirm` · Coinzy **`subs_confirm`** |
| Catalogue | **Open:** `Collection_screen`, `Global_catalogue_screen`. Detail: Banknote `banknote_details_*` · Coinzy `Coin_details*` |
| Collection add | `Added_to_collection*` (+ Coinzy `Added _to_collection_owned` space typo) |
| Marketplace | `marketplace_screen`, `market_item_expolre`, `market_contact` |
| Feed | `Feed_screen`, `feed_like`, `feed_comment`, `feed_add` |
| Expert evaluation (Coinzy) | `expert_evaluation_landing` → `expert_upload_photos` → continue → `expert_request_queued` → `expert_evaluation_report`; credits: `expert_evaluation_buy_credits` → `expert_token_purchase_consumed` |
| Onboarding | `Onboarding_complete`, `Onboarding_skipped` |

**Params flattened:** `user_id`, `country`, `platform`, `banknote_id`, `coin_id`, `pack_name`, `utm_*`, quota remaining fields, `filter_name`, `app_name`, `session_length_seconds`.

---

## 5. View builders (deploy for full product SQL)

| File | View |
|------|------|
| `sql/01_v_events_normalized.sql` | Base |
| `sql/02_v_daily_active_users.sql` | DAU |
| `sql/03_v_monthly_active_users.sql` | MAU |
| `sql/04_v_new_users.sql` | Cohorts |
| `sql/05_v_country_metrics.sql` | Countries |
| `sql/06_v_retention_cohorts.sql` | Retention |
| `sql/07_v_subscription_metrics.sql` | Paywall |
| `sql/08_v_identify_metrics.sql` | Funnel / success / quota |
| `sql/10_v_engagement_metrics.sql` | Scans / catalogue / marketplace |
| `sql/11_v_attribution_metrics.sql` | UTM |
| `sql/12_v_onboarding_metrics.sql` | Onboarding |
| `sql/14_v_time_to_first_scan.sql` | Time to first scan |
| `sql/13_v_product_kpi_daily.sql` | Daily rollup |

```bash
# Banknote product metrics
./scripts/deploy-product-metrics.sh

# Or full view set for any project
GCP_PROJECT=… BQ_DATASET=… GOOGLE_APPLICATION_CREDENTIALS=… \
  ./scripts/deploy-product-views.sh
```

---

## 6. All dashboard SQL folders

| Folder | Role |
|--------|------|
| `sql/dashboard/product/01`–`10` | MVP KPI queries (views) |
| `sql/dashboard/product/00_mvp_overview_kpis.sql` | Overview rollup |
| `sql/dashboard/product/11`–`15` | Supporting (packs, fails, attribution, onboarding) |
| `sql/dashboard/product/16`–`17` | Legacy compare (shared dataset) |
| `sql/dashboard/product/coinzy/*` | Coinzy-shaped view SQL (when views exist) |
| `sql/dashboard/raw/*` | Coinzy + Compare + explorer fallbacks |
| `sql/dashboard/summary/*` | Summary tables (Banknote + Coinzy) |
| `sql/dashboard/01`–`08` | Executive explorer tabs |

Explorer LTV: MongoDB `cohort_ltv` via daily `refresh-ltv:mongo` (BigQuery read-only at refresh). See `docs/09-cohort-ltv.md`.

---

## 7. Multi-app registry

```bash
PRODUCTS=banknote,coinzy          # comma-separated ids
PRODUCT_<ID>_GCP_PROJECT=…
PRODUCT_<ID>_BQ_DATASET=…
PRODUCT_<ID>_GOOGLE_APPLICATION_CREDENTIALS=…
PRODUCT_<ID>_PREFER_RAW=true|false
PRODUCT_<ID>_COLOR=#hex
```

UI switcher + Compare iterate `registry.list()`. See `docs/02-concise-add-app.md`.

---

*Companion remaining-work doc: `docs/04-full-remaining-work.md`*
