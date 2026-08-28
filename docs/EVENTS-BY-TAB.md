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

**KPI rate = confirm events ÷ paywall events** (not unique people). Impression = in-app `Subs_page` · `Subs_page_discount` · `Subscription_screen`.

**Funnels → Paywall** (unique people): shown → pack click → CTA (`subs_button`) → Banknote `subs_native` (Google sheet) → confirm. Pack mix table = unique people per `pack_name` × discounted / non-discounted.

**Funnels → Onboarding → subs**: only people who saw onboarding. Coinzy pages `subs_page_onboarding_1/2/3` + `Subs_page_onboarding`; skip is a drop. Confirm is subscription taken from that group.

| | Banknote | Coinzy |
|--|----------|--------|
| Pack | `Subs_pack` (`pack_name` + discounted/non-discounted) | `subs_pack` · `subs_pack_discount` |
| CTA | `subs_button` | `subs_button` |
| Native sheet | `subs_native` | — |
| Confirm | `Subs_confirm` | `subs_confirm` · `subs_confirm_discount` · `paid_purchase` · `trial_purchase` |
| Cancel / fail | `Subs_cancel` · `Subs_fail` | `subs_cancel` · `subs_fail` |

### 6. D1 / D4 / D7 retention

Cohort = `first_open`. Returned = **any** Firebase event on that offset day. **D1, D4, and D7 are separate.** D4–D7 = returned on at least one of days 4–7.

### 7. Scans / user

`identification_done_success` events ÷ DAU (average). Percentiles P10 / P25 / P50 / P75 / P95 / P99 are successful IDs per person who scanned that day.

### 8. Identify funnel (open → success)

**Banknote KPI** = distinct success users ÷ Identify entry (`Identify_bottom_nav` ∪ `Identify_home`), same day. Camera is not “open”.

**Coinzy KPI** = distinct success users ÷ camera users (`Identification_screen` ∪ `photo_screen`). `Identify_bottom_nav` also fires when camera opens from Home, so nav ∪ home is not the denominator. Success = `identification_done_success` ∪ `Identification_done`.

The **step path** is Funnels → Identify, not this KPI and not tab 3 (quality).

| Piece | Banknote | Coinzy |
|-------|----------|--------|
| Start | `Identify_bottom_nav` · `Identify_home` | `Identification_screen` · `photo_screen` |
| Success | `identification_done_success` | `identification_done_success` ∪ `Identification_done` |

### 9. Collection vs global catalogue

**Two rates of DAU — not mixed.**

| Chart | Banknote | Coinzy |
|-------|----------|--------|
| Private collection | `Collection_screen` · `private_collection_bottom_nav` | `Collection_screen` · `collection_bottom_nav` |
| Global catalogue | `Global_catalogue_screen` | same |

Step drop-off: Funnels → Private collection / Global catalogue.

### 10. Marketplace

**Rate = marketplace users ÷ DAU.** Feed is **not** mixed in.

`marketplace_screen` · `Marketplace_bottom_nav` / `marketplace_bottom_nav` · `market_item_expolre`

---

## Funnels

Each **row** = distinct users who fired that step’s events (not ordered sessions).

### Identify (all) · Scan · bottom nav · Scan · home / banner · Scan · camera · Scan · gallery

**Banknote** and **Coinzy** do not share the same core path.

**Scan · camera** and **Scan · gallery** are separate tabs (parallel after the camera screen, not later hops). Combined Identify (all) still shows both.

#### Banknote

Entry differs by tab: all = nav ∪ home; nav-only; home-only. **Scan · camera** is a different step list: permission + `photo_clicked_*` only (no upload rows). **Scan · gallery** is upload-only (`photo_uploaded_*`) and **drops permission**. Combined Identify still unions both sources.

| Step | Core? | Events |
|------|-------|--------|
| Identify entry | yes | `Identify_bottom_nav` ∪ `Identify_home` |
| Camera | yes | `Identification_screen` · `photo_screen` |
| Permission | yes | `identification_camera_permission_popup` / `Camera_permission_popup` |
| First image | yes | `photo_clicked_1` ∪ `photo_uploaded_1` |
| Second image | yes | `photo_clicked_2` ∪ `photo_uploaded_2` |
| Crop | no | `photo_cropping_screen_1` / `_2` · `photo_crop_tick_1` / `_2` |
| Scan attempted | yes | `Identification_attempted` ∪ `Identification_done` |
| Submit | yes | `photo_submit_button` · `photos_submitted` |
| Quota | no (drop) | `identiifcation_limit_exceeded` |
| Success | yes | `identification_done_success` |
| Failure | no (drop) | `identification_done_failure` |
| Top 5 / results | yes | `identification_top5_matches` |
| Details | yes | `identification_details_screen` · `banknote_details_identification` |
| Add to collection | yes | `Added_to_collection_identified` · `Added_to_collection_owned` |

#### Coinzy

Real funnel: **Camera → Photos → Submit → ID success → Details.**

`Identify_bottom_nav` also fires when camera opens from Home — it is **not** the first core step (Identify all / nav tabs). Home / banner tab may start at `Identify_home`. After camera, **shutter ∥ gallery** are parallel — **Scan · camera** and **Scan · gallery** are different step lists, not the same funnel filtered. Camera tab: camera → shutter → after crop (plus permission). Gallery tab: camera → inferred gallery → after crop (**no shutter, no permission**). `Photo_clicked` is shutter only; gallery tap has **no event**, so gallery-only = crop/clicked minus shutter. Paths **merge** at `photo_clicked_1/2` on Identify (all). Crop is **0-based**; auto-crop skips `photo_crop_tick_*`. `Identification_attempted` is API start, not a submit conversion. `Identification_done` is success (union with `identification_done_success`), not submit. Quota, Learn more (`idetnification_option_chosen`), owned / sub-collection are **side rows**. **Add-to-collection cannot be measured** — no live Firebase success event (`Added_to_collection_identified` is commented out in the app). Until a dedicated gallery tap event exists, gallery open → pick → crop cannot be measured as its own conversion.

| Step | Core? | Events |
|------|-------|--------|
| Nav / home tap | no | `Identify_bottom_nav` ∪ `Identify_home` (nav also fires from Home) |
| Home CTA | no (yes on home tab) | `Identify_home` |
| Camera | yes | `Identification_screen` · `photo_screen` |
| Permission popup / OS | no | Shutter-only. `Camera_permission_popup` vs OS granted/denied — not 1:1. Gallery can skip |
| Camera shutter | no | `Photo_clicked` (not “taken”; gallery never fires this) |
| Gallery pick | no | **Inferred:** crop `_0`/`_1` + ticks + `photo_clicked_1/2` **minus** `Photo_clicked`. No tap event |
| After crop (merge) | yes | `photo_clicked_1` ∪ `photo_clicked_2` |
| Submit | yes | `photo_submit_button` · `photos_submitted` |
| API started | no | `Identification_attempted` |
| Quota | no (side) | `Identified_limit_reached` + `free_scan_*` |
| Success | yes | `identification_done_success` ∪ `Identification_done` |
| Failure | no (side) | `identification_done_failure` · `Identification_failed` |
| All options / Learn more | no | `identification_all_options_screen` · `idetnification_option_chosen` (Learn more only) |
| Details | yes | `identification_details_screen` · `Coin_details_identification` |

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

In-app only (not onboarding). Unique **users**. Pack mix = people per pack name.

| Step | Banknote | Coinzy |
|------|----------|--------|
| Shown | `Subs_page` · `Subs_page_discount` · `Subscription_screen` | same |
| Pack | `Subs_pack` | `subs_pack` · `subs_pack_discount` |
| CTA | `subs_button` | `subs_button` |
| Native | `subs_native` | — |
| Confirm | `Subs_confirm` | `subs_confirm` · `subs_confirm_discount` · `paid_purchase` · `trial_purchase` |

### Onboarding → subscription (funnel)

Cohort = people who saw onboarding. Later steps (pack / CTA / confirm) only count that group.

| Step | Banknote | Coinzy |
|------|----------|--------|
| Onboarding | `Subs_page_onboarding` | `Subs_page_onboarding` ∪ `subs_page_onboarding_1/2/3` |
| Skip | — | `Subs_page_onboarding_skip` |
| Then | pack → `subs_button` → `subs_native` → `Subs_confirm` | pack → `subs_button` → confirm |

MVP 5 = **event counts**. Funnels = unique people. They will not match.

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
| Installs + time used | `first_open` + same-day `user_engagement` / `session_start` / `App_open` (≥10s = “went in”). Time P10–P99 |
| D0 / D1 percentiles | Install cohort (`first_open`). D0 went-in 10s+ · D1 opened (DAU events). Scans = `identification_done_success` (+ Coinzy `Identification_done`). P10, P25, P50, P75, P90, P95, P99 |
| Scan limits | Quota events (MVP 4) split free vs subscribed using `Subs_confirm` / `subs_confirm` / `paid_purchase` / `in_app_purchase` |
| Free-scan success quota | Coinzy only. **Hit** = `free_scan_success_quota_exhausted` (success remaining → 0). After: `free_scan_blocked` · `free_scan_limit_exceeded` · `free_scan_go_premium_tapped` · `free_scan_not_now_tapped`. Informational: `free_scan_fail_quota_exhausted` · `free_scan_quota_reset`. Not a hit: `free_scan_success_consumed`. Do **not** use `Identified_limit_reached` / `Collection_limit_Reached`. Banknote events TBD. |
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
| Scan quota (MVP 4) | Mixed limit events — **not** `Collection_limit_Reached` |
| Free-scan success quota | Coinzy experiment: **only** `free_scan_success_quota_exhausted`. Not `free_scan_success_consumed`, not `Identified_limit_reached` |
| Coinzy confirm | `subs_confirm` — **not** Banknote’s `Subs_confirm` |
| Same-day first ID | `user_pseudo_id` only |
| LTV revenue | Store purchase events — **not** paywall confirm |
