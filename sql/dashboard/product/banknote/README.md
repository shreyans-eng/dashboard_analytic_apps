# Banknote — MVP 8 / 9 / 10 detailed funnels

Step-level SQL for the SQL Editor. Project guide: `docs/PROJECT.md`.

Events taken from `Banknote-ai-identification/src/util/analytics.ts` (+ v2 call sites).

Run in dashboard **SQL Editor** (Banknote product selected) or via API `/api/query/run`.

| File | KPI | What it shows |
|------|-----|----------------|
| `08_identify_funnel_steps.sql` | 8 | Step users, % of entry, drop-off between steps |
| `08_identify_event_volume.sql` | 8 | Which Identify events fire most (by stage) |
| `09_catalogue_funnel_steps.sql` | 9 | Collection + Global catalogue path + % of DAU |
| `10_marketplace_funnel_steps.sql` | 10 | Marketplace + Feed path + % of DAU |

## Core paths (Banknote)

**8 Identify:**  
`Identify_bottom_nav` ∪ `Identify_home` → `Identification_screen` / `photo_screen` → capture/upload → submit → `identification_done_success` ∪ `Identification_done` → `identification_top5_matches` → `banknote_details_identification`

**9 Catalogue:**  
Two separate funnels, each starting with people who started a session (`session_start` · `App_open` · `first_open`). Collection: session → `Collection_screen` → clicked → sub-collection → details. Global catalogue: session → `Global_catalogue_screen` → item → details. There is no mixed Catalogue (all) tab.

**10 Marketplace:**  
`Marketplace_bottom_nav` → `marketplace_screen` → `market_item_expolre` → `sale_Details_screen` → `market_contact*`  
Feed: `feed_bottom_nav` → `Feed_screen` → like/comment/post

## Notes

- App suffixes `_android` / `_ios` are stripped in SQL.
- Some app event names have typos (`camer_permission_denied`, `idetnification_option_chosen`, `market_item_expolre`) — SQL includes them.
- Crop cancel has **no** analytics event in the app.
- High-level MVP cards still use `product_daily_signals`; these files are for **step-level** drop-off analysis.
