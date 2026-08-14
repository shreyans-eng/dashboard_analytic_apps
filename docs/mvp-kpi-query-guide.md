# Product Analytics Guide — Banknote AI & Coinzy

**Shareable reference:** journey, **10 MVP KPIs**, **every query we use**, and the **exact Firebase events / params** that power them.

| | Banknote AI | Coinzy |
|--|-------------|--------|
| **GCP project** | `banknote-app-4f3fd` | `coinzy-26a4d` |
| **BigQuery dataset** | `analytics_488476338` | `analytics_487601380` |
| **Dashboard query mode** | Product **views** (+ executive views / summary) | **Raw** `events_*` (`COINZY_PREFER_RAW=true`) |
| **Entity** | banknote · param `banknote_id` | coin · param `coin_id` |
| **Journey** | Same | Same |

**Stack:** Firebase Analytics → BigQuery → `banknote-analytics-dashboard/`

**Event naming rule:** Apps may append `_android` / `_ios`. Analytics strips that into `event_name_base` before matching. Prefer the **Preferred** name below; listed aliases are also accepted in SQL.

---

## 1. Goal

Measure product outcomes across:

```text
Acquire → Onboard → Identify → Trust → Collect → Limit → Pro → Return
```

The 10 MVP KPIs answer: *Are we growing? Do people get Identify value? Do free limits push Pro? Do catalogue and marketplace deepen the habit?*

---

## 2. Key areas

| Area | Focus | Metrics |
|------|--------|---------|
| **Growth** | Acquire & onboard | DAU, installs, attribution, onboarding |
| **Identify** | Core value + funnel | Time to first scan, success/failure, no-match, identify funnel |
| **Free limits** | Quota pressure | Quota hits, post-limit paywall behavior |
| **Monetization** | Paywall → Pro | Paywall, purchases, packs, cancellations |
| **Retention** | Come back & deepen | D1 / D7 / D30, scans per user |
| **Catalogue** | Browse / detail | Opens, detail views, filters |
| **Collection** | Identify → habit | Add-to-collection after successful ID |
| **Marketplace** | Commerce | Listing / market opens, contact seller |
| **Feed** | Secondary | Posts / likes |

**Not in MVP:** free-scan / `scan_limit_variant` experiment (deprecated SQL kept separately).

---

## 3. MVP KPIs — definitions

| # | KPI | Formula |
|---|-----|---------|
| 1 | **DAU** | Distinct `resolved_user_id` per day |
| 2 | **Time to first scan** | Day-0 first success rate + median seconds install → first `identification_done_success` |
| 3 | **Identification success rate** | `success / (success + failure)` |
| 4 | **Quota hit rate** | Users who hit quota ÷ users who attempted a scan |
| 5 | **Paywall → purchase** | `Subs_confirm` count ÷ `Subs_page` (+ discount) impressions |
| 6 | **D1 / D7 retention** | Cohort return on day +1 / +7 (D30 on same retention view) |
| 7 | **Scans per active user** | Successful ID events ÷ DAU |
| 8 | **Identify funnel conversion** | Open → camera → photo → submit → success |
| 9 | **Catalogue / collection engagement** | Catalogue open rate, detail rate, add-after-ID rate |
| 10 | **Marketplace engagement** | Marketplace users ÷ DAU (+ contact-seller rate) |

---

## 4. How we resolve users, country, platform

Used everywhere (views + raw):

| Field | Resolution |
|-------|------------|
| **User** (`resolved_user_id`) | `COALESCE(user_id, event_params.user_id, user_pseudo_id)` |
| **Country** | `COALESCE(event_params.country, geo.country, 'Unknown')` |
| **Platform** | Param `platform`, else suffix `_android`/`_ios`, else `device.operating_system` |
| **Event base** | Strip trailing `_android` / `_ios` from `event_name` |

---

## 5. Event params we flatten (`v_events_normalized`)

| Param key | Used for |
|-----------|----------|
| `user_id` | Identity |
| `country` | Country filter / dimension |
| `platform` | Platform dimension |
| `banknote_id` | Banknote entity |
| `coin_id` | Coinzy entity |
| `option_number` | Multi-option / distrust |
| `failure_limit`, `failure_remaining`, `success_limit`, `success_remaining` | Quota remaining |
| `scan_limit_variant`, `quota_mode` | Legacy experiment only |
| `pack_name`, `discounted_type`, `action`, `error` | Subscription |
| `filter_name`, `filter_fields`, `collection_name` | Catalogue filters |
| `app_name` | Product split when shared dataset |
| `session_length_seconds`, `time_spent` | Session / engagement |
| `login_type`, `registration_type`, `screen_index`, `screen_name`, `variant` | Auth / onboarding |
| `utm_source`, `utm_medium`, `utm_campaign` | Attribution |

---

## 6. Full event dictionary (what we track)

### 6.1 Growth / install / session

| Preferred event | Also accepted | Used in |
|-----------------|---------------|---------|
| `first_open` | `first_open_android`, `first_open_ios` | New users, retention cohort, attribution, installs |
| `App_open` | `App_open_android`, `App_open_ios` | Session-start flag in normalized view |
| `Registration` | — | Fallback cohort if no `first_open` |

### 6.2 Onboarding (supporting)

| Preferred | Also accepted | Used in |
|-----------|---------------|---------|
| `onboarding_start` | `Onboarding_start`, `Onboarding_begin`, `onboarding_shown`, `Onboarding` | `v_onboarding_metrics` |
| `onboarding_complete` | `Onboarding_complete`, `Onboarding_finish`, `onboarding_finished`, `onboarding_done` | Completion rate |
| `Onboarding*` + `screen_index` | any `onboarding*` | Screen drop-off |

### 6.3 Identify funnel (MVP 2, 3, 8)

| Step | Preferred event | Also accepted |
|------|-----------------|---------------|
| Open | `Identify_bottom_nav` ∪ `Identify_home` | `Identification_screen`, `Identify_open`, `Identify`, `identify_open` |
| Camera granted | `camera_permission_granted` | `Camera_permission_granted` |
| Camera denied | `camera_permission_denied` | `camer_permission_denied` (Banknote typo) |
| Photo | `photo_clicked_1` / `photo_clicked_2` | `Photo_clicked`, `photo_captured` |
| Submit | `photo_submit_button` ∪ `photos_submitted` | `Identification_done` |
| **Success** | **`identification_done_success`** | `Identification_done_success` |
| **Failure** | **`identification_done_failure`** | `Identification_failed`, `Identification_unsuccessful` |
| Multi-option | `identification_all_options_screen` | `idetnification_option_chosen` (typo in both apps) |
| Details after ID | `identification_details_screen` | Banknote: `banknote_details_identification` · Coinzy: `Coin_details_identification` |

**Coinzy Identify path (app-verified):**  
`Identify_bottom_nav` ∪ `Identify_home` → `Identification_screen` / `photo_screen` → capture → `photo_cropping_screen_*` → submit → `identification_done_success`

### 6.4 Free limits / quota (MVP 4)

| Preferred | Also accepted |
|-----------|---------------|
| `Identified_limit_reached` | `identified_limit_reached`, `scan_quota_exhausted`, `Scan_quota_exhausted`, `limit_exceeded`, `Limit_exceeded` |
| Coinzy free-scan experiment | `free_scan_limit_exceeded`, `free_scan_blocked`, `free_scan_success_quota_exhausted` |

**Attempt denominator** also counts: success, failure, and `Identification_done`.

### 6.5 Monetization (MVP 5 + supporting)

| Preferred | Also accepted | Role |
|-----------|---------------|------|
| `Subs_page` | `Subscription_screen`, `Subs_page_onboarding` | Paywall impression (standard) |
| `Subs_page_discount` | — | Paywall impression (discount) |
| `subscription_shown` | — | Users who saw paywall (user-level) |
| `Subs_pack` | Coinzy: **`subs_pack`**, `subs_pack_discount` | Pack click |
| **`Subs_confirm`** | Coinzy: **`subs_confirm`**, `subs_confirm_discount`, `paid_purchase` | **Purchase confirm** |
| `Subs_fail` | Coinzy: `subs_fail` | Purchase fail |
| `Subs_cancel` | Coinzy: `subs_cancel` | Cancel |
| `Subs_restore` | — | Restore |
| `go_pro_button` | — | Entry |
| `subs_discount_banner` | — | Entry |

### 6.6 Catalogue / collection (MVP 9)

| Preferred | Also accepted | Role |
|-----------|---------------|------|
| `Collection_screen` | `collection_bottom_nav`, `Collection_open`, `collection_open`, `Collection`, `My_collection` | Catalogue / collection open |
| `Global_catalogue_screen` | `Global_catalogue` | Global catalogue |
| Detail | Banknote: `banknote_details_*` · Coinzy: **`Coin_details`**, `Coin_details_collection`, `Coin_details_global` | Detail view |
| `Added_to_collection*` | Coinzy also: `Added _to_collection_owned` (space typo), `add_to_wishlist` | Add after ID |

### 6.7 Marketplace & feed (MVP 10 + secondary)

| Preferred | Also accepted | Role |
|-----------|---------------|------|
| `marketplace_screen` | `marketplace_bottom_nav`, `Marketplace_open`, `Market_open`, `Listing_view` | Marketplace engagement |
| `market_item_expolre` | (typo in both apps) | Listing tap |
| `market_contact` | `market_contact_button`, `contact_seller` | Commerce action |
| `Feed_screen` | `feed_bottom_nav`, `feed_like`, `feed_comment`, `feed_add` | Feed |
| `Homescreen` | `home_bottom_nav`, `Home`, `Home_open` | Feature mix |

### 6.8 Attribution params (on install / early events)

`utm_source`, `utm_medium`, `utm_campaign` (event params).

---

## 7. Each MVP KPI → queries + events

### MVP 1 — DAU

| | Path |
|--|------|
| **Banknote query** | `sql/dashboard/product/01_dau.sql` |
| **Banknote view** | `v_daily_active_users` ← `sql/02_v_daily_active_users.sql` |
| **Coinzy query** | `sql/dashboard/raw/01_dau.sql` |
| **Executive** | `sql/dashboard/01_daily_active_users.sql` · summary `summary/01_dau.sql` |
| **Events** | Any event that day (distinct users). Not a single event name. |

### MVP 2 — Time to first scan

| | Path |
|--|------|
| **Banknote query** | `sql/dashboard/product/02_time_to_first_scan.sql` |
| **Banknote view** | `v_time_to_first_scan` ← `sql/14_v_time_to_first_scan.sql` (+ `v_new_users`) |
| **Coinzy today** | Not full median in raw; Compare uses success/install signals via `raw/16_product_daily_signals.sql` |
| **Events** | Cohort: `first_open` (or `Registration` / first event). Success: **`identification_done_success`** |

### MVP 3 — Identification success rate

| | Path |
|--|------|
| **Banknote query** | `sql/dashboard/product/03_identify_success_rate.sql` |
| **Banknote view** | `v_identify_metrics` ← `sql/08_v_identify_metrics.sql` |
| **Coinzy / Compare** | `sql/dashboard/raw/16_product_daily_signals.sql` → `identification_success_rate` |
| **Coinzy view-SQL (optional)** | `sql/dashboard/product/coinzy/03_identify_success_rate.sql` |
| **Events** | **`identification_done_success`**, **`identification_done_failure`** |

### MVP 4 — Quota hit rate

| | Path |
|--|------|
| **Banknote query** | `sql/dashboard/product/04_quota_hit_rate.sql` |
| **Banknote view** | `v_identify_metrics` |
| **Coinzy / Compare** | `raw/16_product_daily_signals.sql` → `free_quota_hit_rate` |
| **Events (numerator)** | `Identified_limit_reached`, `identified_limit_reached`, `scan_quota_exhausted`, `limit_exceeded` (+ Scan_/Limit_ variants) |
| **Events (denominator)** | success, failure, `Identification_done` |

### MVP 5 — Paywall → purchase

| | Path |
|--|------|
| **Banknote query** | `sql/dashboard/product/05_paywall_conversion.sql` |
| **Banknote view** | `v_subscription_metrics` ← `sql/07_v_subscription_metrics.sql` |
| **Coinzy / Compare** | `raw/16_product_daily_signals.sql` → `paywall_to_confirm_rate` |
| **Events** | Paywall: **`Subs_page`**, **`Subs_page_discount`**. Purchase: **`Subs_confirm`**. Users saw paywall also: `subscription_shown` |

### MVP 6 — D1 / D7 retention

| | Path |
|--|------|
| **Banknote query** | `sql/dashboard/product/06_retention_d1_d7.sql` |
| **Banknote view** | `v_retention_cohorts` ← `sql/06_v_retention_cohorts.sql` |
| **Banknote executive** | `dashboard/05_d1_retention.sql`, `06_d7_retention.sql` · summary `05`/`06`/`09` |
| **Coinzy** | `sql/dashboard/raw/05_d1_retention.sql`, `06_d7_retention.sql`, `09_retention.sql` |
| **Events** | Cohort: **`first_open`**. Return: any activity on day +1 / +7 |

### MVP 7 — Scans per active user

| | Path |
|--|------|
| **Banknote query** | `sql/dashboard/product/07_scans_per_user.sql` |
| **Banknote view** | `v_engagement_metrics` ← `sql/10_v_engagement_metrics.sql` |
| **Coinzy / Compare** | `raw/16_product_daily_signals.sql` → `scans_per_dau` |
| **Events** | **`identification_done_success`** ÷ DAU |

### MVP 8 — Identify funnel conversion

| | Path |
|--|------|
| **Banknote query** | `sql/dashboard/product/08_identify_funnel_conversion.sql` |
| **Banknote view** | `v_identify_metrics` |
| **Coinzy / Compare** | `raw/16` → `open_to_success_rate` (open→success only; step funnel needs views) |
| **Coinzy view-SQL** | `product/coinzy/08_identify_funnel_conversion.sql` |
| **Events** | See §6.3. Step-level: `product/banknote/08_identify_funnel_steps.sql` · `product/coinzy/08_identify_funnel_steps.sql` |

### MVP 9 — Catalogue / collection engagement

| | Path |
|--|------|
| **Banknote query** | `sql/dashboard/product/09_catalogue_engagement.sql` |
| **Banknote view** | `v_engagement_metrics` |
| **Coinzy / Compare** | `raw/16` → `catalogue_open_rate` |
| **Coinzy view-SQL** | `product/coinzy/09_catalogue_engagement.sql` |
| **Events** | Opens: `Collection_screen` ∪ `Global_catalogue_screen`. Detail: Banknote `banknote_details_*` · Coinzy `Coin_details*`. Add: `Added_to_collection*` |

### MVP 10 — Marketplace engagement

| | Path |
|--|------|
| **Banknote query** | `sql/dashboard/product/10_marketplace_engagement.sql` |
| **Banknote view** | `v_engagement_metrics` |
| **Coinzy / Compare** | `raw/16` → `marketplace_engagement_rate` |
| **Coinzy view-SQL** | `product/coinzy/10_marketplace_engagement.sql` |
| **Events** | `marketplace_screen`, `market_item_expolre`; contact: `market_contact` / `market_contact_button` |

### Overview rollup

| | Path |
|--|------|
| **Banknote** | `sql/dashboard/product/00_mvp_overview_kpis.sql` ← `v_product_kpi_daily` + identify + engagement |
| **Coinzy optional** | `sql/dashboard/product/coinzy/00_mvp_overview_kpis.sql` |
| **View build** | `sql/13_v_product_kpi_daily.sql` |

---

## 8. Complete SQL inventory

### 8.1 View builders (`sql/`)

| File | Object |
|------|--------|
| `01_v_events_normalized.sql` | Base flatten of `events_*` |
| `02_v_daily_active_users.sql` | DAU grain |
| `03_v_monthly_active_users.sql` | MAU |
| `04_v_new_users.sql` | Install / cohort |
| `05_v_country_metrics.sql` | Country |
| `06_v_retention_cohorts.sql` | D1/D7/D14/D30 |
| `07_v_subscription_metrics.sql` | Paywall / packs / purchase |
| `08_v_identify_metrics.sql` | Funnel, success, quota, no-match |
| `09_v_scan_experiment_metrics.sql` | **Deprecated** free-scan experiment |
| `10_v_engagement_metrics.sql` | Scans/user, catalogue, marketplace, feed |
| `11_v_attribution_metrics.sql` | UTM attribution |
| `12_v_onboarding_metrics.sql` | Onboarding |
| `13_v_product_kpi_daily.sql` | Daily KPI rollup |
| `14_v_time_to_first_scan.sql` | Time to first scan |

Deploy: `./scripts/deploy-product-metrics.sh` or `./scripts/deploy-product-views.sh`

### 8.2 Product dashboard queries (`sql/dashboard/product/`)

| File | Purpose |
|------|---------|
| `00_mvp_overview_kpis.sql` | Overview of MVP signals |
| `01_dau.sql` | MVP 1 |
| `02_time_to_first_scan.sql` | MVP 2 |
| `03_identify_success_rate.sql` | MVP 3 |
| `04_quota_hit_rate.sql` | MVP 4 |
| `05_paywall_conversion.sql` | MVP 5 |
| `06_retention_d1_d7.sql` | MVP 6 |
| `07_scans_per_user.sql` | MVP 7 |
| `08_identify_funnel_conversion.sql` | MVP 8 |
| `09_catalogue_engagement.sql` | MVP 9 |
| `10_marketplace_engagement.sql` | MVP 10 |
| `11_pack_revenue_mix.sql` | Supporting monetization |
| `12_subs_fail_cancel.sql` | Supporting monetization |
| `13_engagement_loops.sql` | Supporting engagement |
| `14_attribution.sql` | Supporting growth |
| `15_onboarding.sql` | Supporting growth |
| `16_compare_apps_daily.sql` | Legacy compare (shared dataset) |
| `17_compare_apps_summary.sql` | Legacy compare summary |
| `_deprecated_08_free_scan_experiment.sql` | Deprecated experiment |
| `coinzy/00_mvp_overview_kpis.sql` | Coinzy-shaped overview |
| `coinzy/01_dau.sql` | Coinzy-shaped DAU |
| `coinzy/03_identify_success_rate.sql` | Coinzy-shaped success |
| `coinzy/08_identify_funnel_conversion.sql` | Coinzy-shaped funnel rollup |
| `coinzy/08_identify_funnel_steps.sql` | Coinzy Identify **step** drop-off |
| `coinzy/08_identify_event_volume.sql` | Coinzy Identify event volume by stage |
| `coinzy/09_catalogue_engagement.sql` | Coinzy-shaped catalogue rollup |
| `coinzy/09_catalogue_funnel_steps.sql` | Coinzy Catalogue **step** drop-off |
| `coinzy/10_marketplace_engagement.sql` | Coinzy-shaped marketplace rollup |
| `coinzy/10_marketplace_funnel_steps.sql` | Coinzy Marketplace + Feed **step** drop-off |

### 8.3 Raw queries — Coinzy + Compare (`sql/dashboard/raw/`)

| File | Purpose |
|------|---------|
| `01_dau.sql` | DAU from `events_*` |
| `02_mau.sql` | MAU |
| `03_new_users.sql` | `first_open` cohorts |
| `04_countries.sql` | Top countries |
| `05_d1_retention.sql` | D1 raw |
| `06_d7_retention.sql` | D7 raw |
| `07_top_events.sql` | Event frequency |
| `08_platform.sql` | Android / iOS |
| `09_retention.sql` | Combined D1+D7 |
| `16_product_daily_signals.sql` | **Compare + Coinzy product signals** (MVP 1,3–5,7–10 proxies) |

### 8.4 Executive dashboard (legacy tabs)

| File | Tab |
|------|-----|
| `sql/dashboard/01_daily_active_users.sql` | DAU |
| `02_monthly_active_users.sql` | MAU |
| `03_new_users.sql` | New users |
| `04_top_countries.sql` | Countries |
| `05_d1_retention.sql` | D1 |
| `06_d7_retention.sql` | D7 |
| `07_top_events.sql` | Events |
| `08_platform_breakdown.sql` | Platform |

### 8.5 Summary tables (Banknote when `USE_SUMMARY_TABLES=true`)

`sql/dashboard/summary/01_dau.sql` … `09_retention.sql`, `kpi.sql`, `04_countries.sql`, etc.

---

## 9. Compare Apps

| Piece | SQL |
|-------|-----|
| Live Compare (per product, then merge) | `sql/dashboard/raw/16_product_daily_signals.sql` |
| Legacy dual SQL | `product/16_compare_apps_daily.sql`, `17_compare_apps_summary.sql` |

UI: **Compare** → `/compare`. Shared filters: date, country, platform.

Signals from `16_product_daily_signals.sql`:  
`dau`, `installs`, `identification_success_rate`, `scans_per_dau`, `free_quota_hit_rate`, `paywall_to_confirm_rate`, `open_to_success_rate`, `catalogue_open_rate`, `marketplace_engagement_rate`, `paying_users`, …

---

## 10. Same vs different

| Layer | Same? | Detail |
|-------|-------|--------|
| Journey & 10 KPIs | Yes | Same definitions |
| Event contract | Mostly | Same names; entity params differ |
| SQL structure | Yes | `01`–`10` + raw equivalents |
| Entity / ID | Diff | `banknote_id` vs `coin_id`; `banknote_detail` vs `coin_detail` |
| BQ project | Diff | Separate Firebase exports |
| Dashboard path today | Diff | Banknote = views · Coinzy = raw |

---

## 11. App instrumentation checklist (ship these)

Log **Preferred** names on both apps (suffix `_android` / `_ios` OK):

1. `first_open`
2. Identify: `Identify_open` → `camera_permission_granted|denied` → `photo_captured` → `identification_submit` → `identification_done_success` / `identification_done_failure`
3. Quota: `Identified_limit_reached` (or `scan_quota_exhausted`)
4. Paywall: `Subs_page` / `Subs_page_discount` → `Subs_pack` → `Subs_confirm` (+ `Subs_fail` / `Subs_cancel`)
5. Catalogue: `Collection_open`, detail (`banknote_detail` or `coin_detail`), `Added_to_collection*` with entity id
6. Marketplace: `Marketplace_open` / `Listing_view`, `contact_seller`
7. Params: `user_id`, `country`, `platform`, `banknote_id` or `coin_id`, UTM on install, quota remaining fields if available

Missing or renamed events → rates near zero or empty funnel steps.

---

## 12. Related docs

| Doc | Purpose |
|-----|---------|
| **This file** | Full share guide: KPIs + all queries + events |
| `docs/adding-a-new-app.md` | How to register another product |
| `docs/banknote-product-metrics.md` | Shorter product notes |
| `docs/product-analytics-banknote-vs-coinzy.md` | Same-vs-diff summary |

---

*Last updated: August 2026 — MVP = 10 KPIs; free-scan experiment deprecated.*
