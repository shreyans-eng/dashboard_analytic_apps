# Events used by each dashboard tab

Simple map: **sidebar tab → Firebase events the query counts**.

Companion: [QUERIES-BY-TAB.md](./QUERIES-BY-TAB.md) (which SQL file). Architecture: [PROJECT.md](./PROJECT.md).

`_android` / `_ios` is stripped before matching. Typos in names are real (`identiifcation_limit_exceeded`, `market_item_expolre`). PascalCase aliases that never fire are omitted.

---

## Shared (almost every KPI)

| Meaning | Events |
|---------|--------|
| **Opened the app (DAU)** | `session_start` · `App_open` · `first_open` |
| **Install** | `first_open` |
| **Successful ID** | `identification_done_success` |
| **Not DAU** | `notification_display` and other push events (shown separately) |

Home and Product Analytics **do not query BigQuery**.

---

## Compare Apps · Health report

Same daily signals as the 10 MVP KPIs below (one query per app). Health report also uses Identify leak, same-day first scan, paywall, and Coinzy Expert from those same events.

---

## MVP KPIs (10)

### 1. DAU (opened app)

`session_start` · `App_open` · `first_open`

### 2. Install → first scan

| Piece | Event |
|-------|--------|
| Install | `first_open` |
| Same-day scan | `identification_done_success` on the **same device** (`user_pseudo_id`) **same calendar day** |

### 3. Identify success

**Rate = success events ÷ (success + failure events)** (not unique users).

| | Banknote | Coinzy |
|--|----------|--------|
| Success | `identification_done_success` | same |
| Failure | `identification_done_failure` | `identification_done_failure` · `Identification_failed` |

### 4. Quota hit

**Rate = users who hit scan quota ÷ users who attempted a scan.** Not collection limit.

| | Banknote | Coinzy |
|--|----------|--------|
| Quota | `identiifcation_limit_exceeded` | `Identified_limit_reached` · `free_scan_limit_exceeded` · `free_scan_blocked` · `free_scan_success_quota_exhausted` · `free_scan_fail_quota_exhausted` |
| Attempt | success + failure | success + failure (+ `Identification_failed`) |

### 5. Paywall → purchase

**Rate = confirm events ÷ paywall events.**

| | Banknote | Coinzy |
|--|----------|--------|
| Paywall | `Subs_page` · `Subs_page_discount` | `Subs_page` · `Subs_page_discount` · `Subscription_screen` · `Subs_page_onboarding` |
| Confirm | `Subs_confirm` | `subs_confirm` · `subs_confirm_discount` · `paid_purchase` |

### 6. D1 / D7 retention

Cohort = `first_open`. Returned = **any** Firebase event on D+1 / D+7.

### 7. Scans / user

`identification_done_success` events ÷ DAU.

### 8. Identify funnel (open → success)

**Rate = distinct success users ÷ Identify entry users, same day.** Camera is not “open”.

| Piece | Events |
|-------|--------|
| Open | `Identify_bottom_nav` · `Identify_home` |
| Success | `identification_done_success` |

### 9. Catalogue

**Rate = catalogue users ÷ DAU.**

| App | Events counted as “opened catalogue” |
|-----|--------------------------------------|
| Banknote | `Collection_screen` · `Global_catalogue_screen` · `private_collection_bottom_nav` |
| Coinzy | `Collection_screen` · `Global_catalogue_screen` · `collection_bottom_nav` |

### 10. Marketplace

**Rate = marketplace users ÷ DAU.** Feed is **not** mixed in.

`marketplace_screen` · `Marketplace_bottom_nav` / `marketplace_bottom_nav` · `market_item_expolre`

---

## Funnels

Each **row** = distinct users who fired that step’s events (not ordered sessions).

### Identify (all) · Scan · bottom nav · Scan · home / banner

Same steps. Entry differs:

| Tab | Entry events |
|-----|----------------|
| Identify (all) | `Identify_bottom_nav` ∪ `Identify_home` |
| Scan · bottom nav | `Identify_bottom_nav` only |
| Scan · home / banner | `Identify_home` only |

| Step | Events |
|------|--------|
| Camera | `Identification_screen` · `photo_screen` |
| First image | `photo_clicked_1` ∪ `photo_uploaded_1` (also split camera vs gallery) |
| Second image | `photo_clicked_2` ∪ `photo_uploaded_2` |
| Crop (Banknote) | `photo_cropping_screen_1` / `_2` · `photo_crop_tick_1` / `_2` |
| Crop (Coinzy) | `photo_cropping_screen_0` / `_1` · `photo_crop_tick_0` / `_1` |
| Submit | `photo_submit_button` · `photos_submitted` (Coinzy also `Identification_done`) |
| Quota | Banknote `identiifcation_limit_exceeded` · Coinzy `Identified_limit_reached` + `free_scan_*` |
| Success | `identification_done_success` |
| Failure | `identification_done_failure` (Coinzy also `Identification_failed`) |

### Private collection

| Step | Banknote | Coinzy |
|------|----------|--------|
| Nav | `private_collection_bottom_nav` | `collection_bottom_nav` |
| Screen | `Collection_screen` | same |
| Card | `Collection_clicked` | same |
| Sub-collection | `Sub_collection_Screen` | same |
| Details | `banknote_details_collection` | `Coin_details_collection` · `Coin_details` |

### Global catalogue

`Global_catalogue` → `Global_catalogue_screen` → `global_catalogue_item` → `banknote_details_global` / `Coin_details_global`

### Catalogue (all)

Private collection **plus** global catalogue (both paths on one page).

### Marketplace (funnel)

`Marketplace_bottom_nav` / `marketplace_bottom_nav` → `marketplace_screen` → `market_item_expolre` → `sale_Details_screen` → `market_contact`

### Feed

`feed_bottom_nav` → `Feed_screen` → `feed_like` / `feed_comment` → `feed_add`

### Paywall (funnel)

| | Banknote | Coinzy |
|--|----------|--------|
| Impression | `Subs_page` · `Subs_page_discount` · `Subscription_screen` · `Subs_page_onboarding` | same |
| Confirm | `Subs_confirm` | `subs_confirm` · `subs_confirm_discount` · `paid_purchase` |

Funnel = unique **users**. MVP 5 = **event counts**. They will not match.

### Expert evaluation (Coinzy only)

`expert_evaluation_landing` → `expert_upload_photos` → continue (credit or pay) → `expert_request_queued` → `expert_evaluation_report`

Credits path: `expert_evaluation_buy_credits` → payment continue → `expert_token_purchase_received` → `expert_token_purchase_consumed`

---

## Event inventory

Whatever event you pick. Hits + unique users. Use this to check an event actually fires.

---

## Explorer

| Tab | Events |
|-----|--------|
| Daily Active Users | Same as MVP 1 (`session_start` · `App_open` · `first_open`) |
| Unique vs repeat | Any event (new vs returning) |
| Monthly Active Users | Any event in the calendar month |
| New Users | `first_open` |
| Installs + time used | `first_open` + same-day `user_engagement` / `session_start` / `App_open` (≥10s = “went in”) |
| Scan limits | Quota events (MVP 4) split free vs subscribed using `Subs_confirm` / `subs_confirm` / `paid_purchase` / `in_app_purchase` |
| D1 / D7 Retention | Same as MVP 6 |
| Top Countries / Platform | Any event |
| Top Events | All events (`COUNT(*)`) |
| Cohort LTV | Install = `first_open` · revenue = `in_app_purchase` / `purchase` (**not** `Subs_confirm`) |

---

## Do not mix these up

| Looks similar | Query uses |
|---------------|------------|
| Identify “open” | Nav ∪ home — **not** `Identification_screen` |
| Marketplace KPI | Market screen / nav / listing — **not** Feed |
| Scan quota | Scan limit events — **not** `Collection_limit_Reached` |
| Coinzy confirm | `subs_confirm` — **not** Banknote’s `Subs_confirm` |
| Same-day first ID | `user_pseudo_id` only |
| LTV revenue | Store purchase events — **not** paywall confirm |
