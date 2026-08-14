# Banknote AI & Coinzy — Product Metrics (Firebase → BigQuery)

> **Shareable full guide (KPIs + query map for both apps):**  
> [`docs/mvp-kpi-query-guide.md`](./mvp-kpi-query-guide.md)

**Project:** `banknote-app-4f3fd` (Banknote) · `coinzy-26a4d` (Coinzy)  
**Datasets:** `analytics_488476338` · `analytics_487601380`  
**Base view (Banknote):** `v_events_normalized` · **Coinzy dashboard:** raw `events_*`  
**Products:** Banknote AI (paper) · Coinzy (coins) — same journey, entity diffs  
**Cross-product guide:** `docs/product-analytics-banknote-vs-coinzy.md`  
**Goal:** Measure product outcomes across the journey — not vanity event counts.

---

## Product Analytics Focus

**Journey:** Acquire → Onboard → Identify → Trust → Collect → Limit → Pro → Return

### Key areas

| Area | Focus | Metrics |
|------|-------|---------|
| **Growth** | Acquire & onboard | DAU, installs, attribution, onboarding |
| **Identify** | Core value + funnel | Time to first scan, success/failure, no-match, **funnel steps** |
| **Free limits** | Quota pressure | Quota hits, post-limit paywall behavior |
| **Monetization** | Paywall → Pro | Paywall, purchases, packs, cancellations |
| **Retention** | Return & deepen | D1/D7/D30, scans per user |
| **Catalogue** | Browse / detail | Catalogue opens, detail views, filters |
| **Collection** | Identify → habit | Add-after-ID, collection engagement |
| **Marketplace** | Commerce | Listing views, contact seller |
| **Feed** | Secondary | Posts / likes (after core is healthy) |

> **Removed from MVP:** Free-scan variant comparison (`scan_limit_variant`). Kept only as optional/ad-hoc SQL under `_deprecated_08_free_scan_experiment.sql`.

---

## MVP KPIs (10)

| # | KPI | Why |
|---|-----|-----|
| 1 | **DAU** | Baseline health |
| 2 | **Time to first scan** | Core aha / friction |
| 3 | **Identification success rate** | AI + photo UX quality |
| 4 | **Quota hit rate** | Free-limit calibration |
| 5 | **Paywall → purchase** | Monetization conversion |
| 6 | **D1 / D7 retention** | Collector PMF |
| 7 | **Scans per active user** | Engagement depth |
| 8 | **Identify funnel conversion** | Where Identify breaks (open → success) |
| 9 | **Catalogue / collection engagement** | Second loop after Identify |
| 10 | **Marketplace engagement** | Commerce stickiness |

SQL: `sql/dashboard/product/01`–`10_*.sql` · Overview rollup: `00_mvp_overview_kpis.sql`

These ten answer: *Are we growing? Do people get value? Do free limits push Pro? Do catalogue and marketplace deepen the habit?*

---

## Dashboard tabs

| Tab | Focus |
|-----|-------|
| **Overview** | DAU, installs, retention, scans, paid users |
| **Identify** | Funnel, success, no-match, quota, time-to-first-scan |
| **Monetization** | Paywall → purchase, packs, fails/cancels |
| **Engagement** | Catalogue, collection, marketplace, feed |
| **Compare** | Banknote vs Coinzy side-by-side |

---

## Metric → view map (full set)

| # | Metric | View | MVP? |
|---|--------|------|------|
| 1 | DAU / WAU | `v_daily_active_users` | ✅ 1 |
| 2 | Installs / first_open | `v_new_users` | — |
| 3 | Attribution | `v_attribution_metrics` | — |
| 4 | Onboarding | `v_onboarding_metrics` | — |
| 5 | Time-to-first-scan | `v_time_to_first_scan` | ✅ 2 |
| 6 | Identify funnel | `v_identify_metrics` | ✅ 8 |
| 7 | Success rate | `v_identify_metrics` | ✅ 3 |
| 8 | No-match rate | `v_identify_metrics` | — |
| 9 | Quota hit rate | `v_identify_metrics` | ✅ 4 |
| ~~10~~ | ~~Free-scan experiment~~ | ~~`v_scan_experiment_metrics`~~ | ❌ removed from MVP |
| 11 | Paywall → purchase | `v_subscription_metrics` | ✅ 5 |
| 12 | Packs / paid users | `v_subscription_metrics` | — |
| 13 | Fail / cancel | `v_subscription_metrics` | — |
| 14 | D1/D7/D30 | `v_retention_cohorts` | ✅ 6 |
| 15 | Scans per user | `v_engagement_metrics` | ✅ 7 |
| 16 | Collection add after ID | `v_engagement_metrics` | ✅ 9 |
| 17 | Catalogue engagement | `v_engagement_metrics` | ✅ 9 |
| 18 | Marketplace | `v_engagement_metrics` | ✅ 10 |
| 19 | Feed | `v_engagement_metrics` | — secondary |

---

## Event contract (funnel / catalogue / marketplace)

Wire these from the app so funnels and engagement are not empty:

| Area | Canonical events |
|------|------------------|
| Funnel | `Identify_open` → `camera_permission_*` → `photo_captured` → `identification_submit` → `identification_done_success` / `_failure` |
| Quota | `Identified_limit_reached` / `scan_quota_exhausted` |
| Catalogue | `Collection_open`, `Collection_detail` / `banknote_detail` / `coin_detail`, filters |
| Collection add | `Added_to_collection_*` |
| Marketplace | `Marketplace_open` / `Listing_view`, `contact_seller` |
| Feed | `Feed_open`, `Feed_like` / `Feed_post` |

---

## Deploy

```bash
./scripts/deploy-product-metrics.sh
```

`v_scan_experiment_metrics` remains deployable for ad-hoc analysis but is **not** an MVP dashboard card.
