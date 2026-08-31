# Coinzy — MVP queries + detailed funnels

Step-level + Coinzy-shaped SQL. Project guide: `docs/PROJECT.md`.

Events taken from `CoinzyAndroid` (`AnalyticsUtils.logEvent` call sites).

The dashboard **checks** `sql/dashboard/product/coinzy/` first when Coinzy is selected, then falls back to shared `product/*.sql` views. These Coinzy files query **raw** `events_*` (no views required).

Run in dashboard **SQL Editor** (Coinzy product selected) or via API `/api/query/run`.

## High-level MVP cards (raw events)

| File | MVP |
|------|-----|
| `01_dau.sql` | 1 DAU |
| `02_time_to_first_scan.sql` | 2 Time to first scan |
| `03_identify_success_rate.sql` | 3 Success rate |
| `04_quota_hit_rate.sql` | 4 Quota hit (mixed limit events — not the experiment tab) |
| `05_paywall_conversion.sql` | 5 Paywall → `subs_confirm` |
| `07_scans_per_user.sql` | 7 Scans / DAU |
| `08_identify_funnel_conversion.sql` | 8 Funnel (camera→success rollup) |
| `09_catalogue_engagement.sql` | 9 Catalogue rollup |
| `10_marketplace_engagement.sql` | 10 Marketplace rollup |

## Step-level funnels (same pattern as Banknote)

| File | KPI | What it shows |
|------|-----|----------------|
| `08_identify_funnel_steps.sql` | 8 | Step users, % of entry, drop-off between steps |
| `08_identify_event_volume.sql` | 8 | Which Identify events fire most (by stage) |
| `09_catalogue_funnel_steps.sql` | 9 | Collection + Global catalogue path + % of DAU |
| `10_marketplace_funnel_steps.sql` | 10 | Marketplace + Feed path + % of DAU |
| `22_free_scan_success_quota.sql` | Explorer | Success quota HIT = `free_scan_success_quota_exhausted` only |

## Core paths (Coinzy)

**8 Identify:**  
`Identification_screen` / `photo_screen` → shutter (`Photo_clicked`) ∥ inferred gallery (crop/clicked minus shutter) → after-crop merge (`photo_clicked_1/2`) → submit → success (`identification_done_success` ∪ `Identification_done`) → details. Gallery tap has no event. Dashboard tabs: Identify (all) plus **Scan · bottom nav** (nav minus Home) / **Scan · home** (`Identify_home` only) / **Scan · camera** (`Photo_clicked` only) / **Scan · gallery** (crop/clicked minus shutter). Add-to-collection cannot be measured.

**9 Catalogue:**  
Two separate funnels, each starting with people who started a session (`session_start` · `App_open` · `first_open`). Collection: session → `Collection_screen` → clicked → sub-collection → `Coin_details_*`. Global catalogue: session → `Global_catalogue_screen` → item → `Coin_details_global`. There is no mixed Catalogue (all) tab.

**10 Marketplace:**  
`marketplace_bottom_nav` → `marketplace_screen` → `market_item_expolre` → `sale_Details_screen` → `market_contact*`  
Feed: `feed_bottom_nav` → `Feed_screen` → like/comment/post

## Notes

- App suffixes `_android` / `_ios` are stripped in SQL.
- Paywall confirm is **`subs_confirm`** (lowercase), not `Subs_confirm`.
- Details events are `Coin_details_*`, not `banknote_details_*`.
- Compare uses Coinzy `product/coinzy/16_product_daily_signals.sql` when the summary table has no catalogue engagement (stale `Collection_open` aliases). Otherwise it reads `analytics_summary.product_daily_signals`.
