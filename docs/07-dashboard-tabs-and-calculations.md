# Dashboard explain guide — every tab, table, and calculation

How to read **Product Analytics** (`banknote-analytics-dashboard/`): what each sidebar item shows, which chart/table is on the page, and the exact formula behind the number.

**Live app:** switch **Banknote** / **Coinzy** / **Compare** in the sidebar. Filters (date, country, platform) apply after **Apply**.

Related docs: [concise overview](./01-concise-mvp-overview.md) · [queries & events](./03-full-queries-and-events.md) · [summary architecture](./06-summary-architecture.md)

---

## 1. What the dashboard is measuring

Both apps share the same product journey:

```text
Acquire → Onboard → Identify → Trust → Collect → Limit → Pro → Return
```

| App | GCP project | BigQuery dataset |
|-----|-------------|------------------|
| **Banknote** | `banknote-app-4f3fd` | `analytics_488476338` |
| **Coinzy** | `coinzy-26a4d` | `analytics_487601380` |

Source: **Firebase Analytics** exported to BigQuery `events_*` tables (one shard per day).

### Identity, country, platform, event names

Used on almost every query:

| Field | How it is resolved |
|-------|--------------------|
| **User** (`resolved_user_id`) | `COALESCE(user_id, event_params.user_id, user_pseudo_id)` |
| **Country** | `COALESCE(event_params.country, geo.country, 'Unknown')` |
| **Platform** | Event param `platform`, else `_android` / `_ios` suffix, else `device.operating_system` |
| **Event base** | Strip trailing `_android` / `_ios` from `event_name` → `event_name_base` |

A user who fires `Identify_open_android` is counted as `Identify_open`.

### How a number is loaded (query fallback)

For a given app the API tries, in order:

1. **Summary tables** (pre-aggregated, cheap) when they exist
2. **Product views** (`v_daily_active_users`, `v_identify_metrics`, …)
3. **Raw** `events_*` (always works; more bytes)

`SAFE_DIVIDE` is used everywhere: if the denominator is 0, the rate is `NULL` (shown as empty / 0), never a crash.

**Important:** most funnels count **distinct users per step independently**. They are **not** ordered session funnels. Someone can appear on a later step without the earlier one. The UI labels that as “joined without prior step”.

---

## 2. Global chrome (every page)

### Product switcher

| Control | Effect |
|---------|--------|
| **Banknote** / **Coinzy** | All queries run against that app’s project + dataset |
| **Compare** | Side-by-side MVP signals. Funnels and Event inventory are disabled until you pick one app |

### Filters (date / country / platform)

| Filter | Meaning |
|--------|---------|
| **Start / End date** | Inclusive range on `event_date` (UTC calendar day from Firebase). On Cohort LTV this is **install date**. |
| **Country** | Restricts to that country when the query supports it. LTV keeps `Unknown`. |
| **Platform** | `android` or `ios` |
| **Channel** | Cohort LTV only: Organic / Paid / Direct (first `first_open`) |
| **Apply** | Refetches. Changing dates without Apply does not reload charts |

Default range is the last **30 days**.

### Sign-in and access

| Screen | What it does |
|--------|----------------|
| **Login** | Username + password. Session cookie. |
| **Forgot password** | Username **and** email must match the account, then set a new password (≥ 8 characters). |
| **Users & access** (admin) | Create sub-admins, assign apps and pages. See [§11](#11-admin--users--access). |

Sub-admins only see pages and apps an admin assigned. Compare requires access to **both** apps.

---

## 3. Sidebar map

| Section | Tab | Route | Chart / table |
|---------|-----|-------|----------------|
| Overview | Home | `/` | Landing cards only — **no BigQuery query** |
| Overview | Product Analytics | `/product` | Explainers + links — **no live numbers** |
| Overview | Compare Apps | `/compare` | Comparison table + 6 trend charts |
| Funnels | Identify | `/funnels/identify` | KPI cards, bars, hop table, full step table |
| Funnels | Catalogue | `/funnels/catalogue` | Same layout, two paths (collection + global) |
| Funnels | Marketplace | `/funnels/marketplace` | Same layout, two paths (market + feed) |
| Funnels | Paywall | `/funnels/paywall` | Same layout, paywall → confirm |
| Funnels | Event inventory | `/events-explorer` | Event list + daily chart + params table |
| MVP KPIs (10) | 1–10 | `/mvp/...` | One trend chart each |
| Explorer | Cohort LTV, DAU, MAU, New users, D1, D7, Countries, Platform, Events | `/ltv` … `/events` | LTV has KPI + 2 charts + table; others one chart |
| Tools | SQL Editor | `/sql` | Query library + result table |
| Admin | Users & access | `/admin/users` | Access list / create / monthly reports |

---

## 4. Home (`/`)

**Shows:** Welcome copy and cards linking to Product Analytics, Compare, and Explorer metrics.

**Does not query BigQuery.** Data starts loading when you open a metric, funnel, or Compare.

---

## 5. Product Analytics (`/product`)

**Shows:** Journey strip, key-area cards (Growth, Identify, Limits, Monetization, Retention, Catalogue, Collection, Marketplace, Feed), and the list of 10 MVP KPIs with “why it matters”.

**Does not query BigQuery.** It is the product brief. Click a card to open the live KPI or funnel.

---

## 6. Compare Apps (`/compare`)

Runs the **daily product signals** query once per app (`sql/dashboard/raw/16_product_daily_signals.sql` or the summary equivalent), tags each row with the app name, then:

- **Daily charts** = those rows pivoted by date  
- **Comparison table** = one rollup row per app from `summarizeProduct()`

### Comparison table

**Leader** = higher is better, except **Quota hit rate** (lower is better). Tie if values are equal.

Rollup is **not** a single pooled query over the whole period. It mixes last-day, sums, and **simple averages of daily rates**:

| Row | What you see | How the table cell is rolled up | Daily formula (each day) |
|-----|----------------|----------------------------------|---------------------------|
| **Latest DAU** | Active users | **Last day** in the range | Distinct `resolved_user_id` that day |
| **Installs (period)** | New installs | **Sum** of daily install counts | Distinct `first_open` users that day |
| **Identify success** | AI + photo quality | **Average** of daily rates | `success_events ÷ (success + failure)` |
| **Identify funnel** | Open → success | **Average** of daily rates | Distinct success users ÷ distinct Identify-open users |
| **Scans / user-day** | Depth | **Average** of daily `scans_per_dau` | `success_scans ÷ DAU` |
| **Quota hit rate** | Free-limit pressure | **Average** of daily rates | Distinct quota-hit users ÷ scan-attempt users |
| **Paywall → purchase** | Monetization | **Average** of daily rates | Confirm **events** ÷ paywall **events** |
| **Catalogue engagement** | Browse loop | **Average** of daily rates | Distinct catalogue-open users ÷ DAU |
| **Marketplace engagement** | Commerce loop | **Average** of daily rates | Distinct marketplace users ÷ DAU |
| **Paying users** | Pro conversions | **Sum** of daily distinct paying users | Distinct confirm / `paid_purchase` users that day |

Averaging daily rates weights each day equally (a quiet day counts as much as a busy day). Summing daily distinct paying users can double-count someone who confirmed on two different days.

### Trend charts (same formulas, by day)

1. DAU  
2. Identify success  
3. Identify funnel (open → success)  
4. Paywall → purchase  
5. Catalogue engagement  
6. Marketplace engagement  

Same date / country / platform filters apply to **both** apps.

---

## 7. MVP KPIs (10)

Each tab is **one line (or bar) chart**. The query often returns extra columns; the chart plots the **headline rate** in the table below.

SQL (views): `sql/dashboard/product/01`–`10_*.sql`  
SQL (raw / Coinzy-shaped): `sql/dashboard/product/coinzy/` and `sql/dashboard/raw/16_product_daily_signals.sql`

### MVP 1 — DAU (`/mvp/dau`)

| | |
|--|--|
| **Chart** | Line: `dau` vs `event_date` |
| **Shows** | How many unique people used the app that day |
| **Formula** | `COUNT(DISTINCT resolved_user_id)` for any event that day |
| **Why** | Baseline. Every other rate is “of active users” or “of scanners” |

### MVP 2 — Time to first scan (`/mvp/time-to-first-scan`)

| | |
|--|--|
| **Chart** | Line: `day0_first_scan_rate` vs cohort date |
| **Shows** | Share of **new installs that day** who got a **successful ID on the same calendar day** |
| **Cohort** | Users whose first `first_open` is that day |
| **Success** | First `identification_done_success` |
| **Formula** | `users with success_date = cohort_date ÷ cohort_users` |
| **Also in SQL (not charted)** | `median_seconds_to_first_scan` = median seconds from first_open timestamp → first success |

Longer time / lower day-0 rate ⇒ permission, camera, paywall, or confusion.

### MVP 3 — Identify success (`/mvp/identify-success`)

| | |
|--|--|
| **Chart** | Line: `identification_success_rate` |
| **Shows** | Quality of the ID model + photo UX |
| **Formula** | `success_events ÷ (success_events + failure_events)` |
| **Events** | Success: `identification_done_success` · Failure: `identification_done_failure` (Coinzy also accepts `Identification_failed`, `Identification_unsuccessful` on funnels) |

This is **event counts**, not unique users. One user with 3 successes and 1 failure contributes 3 and 1.

### MVP 4 — Quota hit rate (`/mvp/quota-hit`)

| | |
|--|--|
| **Chart** | Line: `free_quota_hit_rate` |
| **Shows** | Free-limit pressure among people who actually tried to scan |
| **Formula** | `distinct users who hit quota ÷ distinct users who attempted a scan` |
| **Quota events** | `Identified_limit_reached`, `scan_quota_exhausted`, `limit_exceeded`; Coinzy also `free_scan_limit_exceeded`, `free_scan_blocked`, `free_scan_success_quota_exhausted`, … |
| **Attempt** | Success, failure, or `Identification_done` |

Higher is not always better: too high too early can mean angry churn; too low can mean weak Pro pressure.

### MVP 5 — Paywall → purchase (`/mvp/paywall`)

| | |
|--|--|
| **Chart** | Line: `paywall_to_confirm_rate` |
| **Shows** | Monetization conversion (impressions → confirms) |
| **Formula** | `purchase_confirm events ÷ paywall impression events` |
| **Paywall** | `Subs_page`, `Subs_page_discount`, `Subscription_screen`, `Subs_page_onboarding` |
| **Confirm** | Banknote: `Subs_confirm` · Coinzy: `subs_confirm` (also `subs_confirm_discount`, `paid_purchase`) |

SQL also returns **user-level** `paying_users ÷ users_saw_paywall` (`user_paywall_conversion_rate`) — not the line that is charted.

### MVP 6 — D1 / D7 retention (`/mvp/retention`)

| | |
|--|--|
| **Chart** | Line: **`d1_retention_rate` only** vs `cohort_date` |
| **Shows** | Of people who installed on day D, who came back on D+1 |
| **Cohort** | `first_open` (min date per user) |
| **Return** | Any event on `cohort_date + 1 day` (D7: +7; D30: +30) |
| **Formula** | `retained_dN ÷ cohort_size` |
| **SQL also has** | `d7_retention_rate`, `d30_retention_rate` (same query; D7/D30 are **not** the drawn line) |

View SQL waits until the cohort is mature enough for D7 (`cohort_date ≤ today − 7`). Explorer D1/D7 tabs use dedicated queries.

### MVP 7 — Scans per user (`/mvp/scans-per-user`)

| | |
|--|--|
| **Chart** | Line: `scans_per_dau` |
| **Shows** | How many successful IDs per active user that day |
| **Formula** | `COUNT(identification_done_success) ÷ DAU` |
| **SQL also has** | `scans_per_scanning_user` = successes ÷ users who had ≥1 success |

Rising DAU + falling scans/user usually means shallow opens (open app, don’t Identify).

### MVP 8 — Identify funnel (`/mvp/identify-funnel`)

| | |
|--|--|
| **Chart** | Line: `open_to_success_rate` |
| **Shows** | Share of Identify-open users who got a success **that same day** (user-level, not ordered) |
| **Formula** | `distinct success users ÷ distinct Identify-open users` |
| **Open** | `Identify_bottom_nav` ∪ `Identify_home` ∪ `Identification_screen` |
| **SQL also has** | `open_to_photo_rate`, `submit_to_success_rate`, `camera_permission_grant_rate` |

For **step-by-step drop-off**, use **Funnels → Identify**, not this KPI chart.

### MVP 9 — Catalogue / collection (`/mvp/catalogue`)

| | |
|--|--|
| **Chart** | Line: `catalogue_open_rate` |
| **Shows** | Share of DAU who opened collection or global catalogue |
| **Formula** | `distinct users with Collection_screen or Global_catalogue_screen ÷ DAU` |
| **SQL also has** | `catalogue_detail_rate` (detail views ÷ DAU), `collection_add_rate_after_id` (added to collection **and** had a success that day ÷ users with success) |

Detail events: Banknote `banknote_details_*` · Coinzy `Coin_details*`.

### MVP 10 — Marketplace (`/mvp/marketplace`)

| | |
|--|--|
| **Chart** | Line: `marketplace_engagement_rate` |
| **Shows** | Share of DAU who used marketplace / listings |
| **Formula** | Distinct marketplace users ÷ DAU |
| **Marketplace users** | `marketplace_screen`, `marketplace_bottom_nav`, `market_item_expolre` (typo is real in the apps) |
| **SQL also has** | `contact_seller_rate` = contact users ÷ marketplace users · `feed_engagement_rate` = feed users ÷ DAU |

---

## 8. Funnel tabs (Identify, Catalogue, Marketplace, Paywall)

These pages share one layout. Data comes from **raw** `events_*` built in `funnel-registry.js` (`buildFunnelSql`).

Each step:

```text
users = COUNT(DISTINCT resolved_user_id) whose event_name_base is in that step’s event list
hits  = COUNT(*) of those events
```

Core-step conversion (SQL):

```text
pct_of_previous = this_step.users ÷ previous_core_step.users
drop_off_users  = max(0, previous_core.users − this.users)
drop_off_rate   = 1 − pct_of_previous
pct_of_dau      = this.users ÷ distinct users with any event in the range
```

UI hop math (same idea, in the browser):

```text
convert = to.users ÷ from.users
dropped = max(0, from − to)
gained  = max(0, to − from)   → “joined without prior step”
```

### Widgets on every funnel page

| Widget | What it shows |
|--------|----------------|
| **Entry users** | Unique users on the first **core** step of the first path |
| **End of core path** | Unique users on the last core step of that path |
| **Core convert** | End ÷ Entry |
| **Largest drop** | Hop with the most dropped users (ignores “gained” hops) |
| **All steps — unique users** | Horizontal bars for **every** mapped step (core + side + drop). Last column = % of previous **core** step |
| **Users by step** | Bar chart of **core path only** |
| **Path strip** | Core steps in order with user counts |
| **Drop-off by hop** | Users lost from step *n* to *n+1* |
| **From → To table** | From, To, Convert, Dropped, Drop %, note |
| **Full step detail** | Every mapped step including side branches |

#### Full step detail columns

| Column | Meaning |
|--------|---------|
| **#** | Step order in the mapping |
| **Step** | Human label. Badge **core** = conversion chain. Badge **drop** = failure / cancel / deny (not in the core chain) |
| **Events** | Firebase `event_name_base` values that count for this step |
| **Users** | Distinct people who fired any of those events in the date range |
| **Hits** | Total event fires (one person can contribute many) |
| **% of previous** | Core only: users ÷ previous core users |
| **Drop-off users / %** | Core only: people on previous core who are not on this step (independent counts, not a true sequential drop) |
| **% of DAU** | Users ÷ all distinct users in range |

---

### 8.1 Identify funnel (`/funnels/identify`)

**Core path:** Entry → Camera screen → Photo → Crop → Submit → Success

| Step | Kind | Events (shared unless noted) |
|------|------|------------------------------|
| Identify entry | core | `Identify_bottom_nav`, `Identify_home` |
| Camera / photo screen | core | `Identification_screen`, `photo_screen` |
| Camera permission popup | side | `Camera_permission_popup` |
| Permission granted | side | `camera_permission_granted` |
| Permission denied | drop | `camera_permission_denied` (Banknote also `camer_permission_denied`) |
| Photo click | core | `photo_clicked_1/2`, `Photo_clicked` (+ Banknote gallery `photo_uploaded_*`) |
| Crop screen | core | `photo_cropping_screen_*` |
| Crop confirmed | side | `photo_crop_tick_*` |
| Submit | core | `photo_submit_button`, `photos_submitted` (Coinzy also `Identification_done`) |
| Quota / limit block | drop | `Identified_limit_reached`, … (Coinzy adds `free_scan_*`) |
| Success | core | `identification_done_success` |
| Failure | drop | `identification_done_failure` (+ Coinzy aliases) |
| Details / add to collection | side | `identification_details_screen`, `Added_to_collection_*` |

---

### 8.2 Catalogue / Collection (`/funnels/catalogue`)

**Two core paths** (the page splits when a new path starts):

1. **Private collection:** Collection screen → card → sub-collection → details  
2. **Global catalogue:** Global screen → item → details  

| Path | Core steps | Key events |
|------|------------|------------|
| Collection | screen → clicked → sub-collection → details | `Collection_screen`, `Collection_clicked`, `Sub_collection_Screen`, Banknote `banknote_details_collection` / Coinzy `Coin_details_collection` |
| Global | screen → item → details | `Global_catalogue_screen`, `global_catalogue_item`, `banknote_details_global` / `Coin_details_global` |
| KPI union (Banknote extra / Coinzy core) | Catalogue open | `Collection_screen` ∪ `Global_catalogue_screen` |

Bottom nav (`private_collection_bottom_nav` / `collection_bottom_nav`) is a side step, not always core.

---

### 8.3 Marketplace + Feed (`/funnels/marketplace`)

**Two core paths:**

1. **Marketplace:** tab → screen → listing tap → sale details → contact seller  
2. **Feed:** Feed screen (likes/comments/posts are side steps)

| Core step | Events |
|-----------|--------|
| Marketplace nav | `Marketplace_bottom_nav` / `marketplace_bottom_nav` |
| Marketplace screen | `marketplace_screen` |
| Listing tap | `market_item_expolre` (**typo is the real event name**) |
| Sale details | `sale_Details_screen` |
| Contact seller | `market_contact`, `market_contact_button` |
| Feed screen | `Feed_screen` |

Side: add-for-sale CTAs, `market_add`, `feed_like`, `feed_comment`, `feed_add`.

---

### 8.4 Paywall → purchase (`/funnels/paywall`)

**Core path:** Paywall impression → purchase confirm  
**Drops:** cancel, fail (Coinzy also pack click as a side step)

| Step | Kind | Events |
|------|------|--------|
| Paywall | core | `Subs_page`, `Subs_page_discount`, `Subscription_screen`, `Subs_page_onboarding` |
| Pack click | side (Coinzy) | `subs_pack`, `subs_pack_discount`, `subs_button` |
| Confirm | core | Banknote `Subs_confirm` · Coinzy `subs_confirm` (+ `subs_confirm_discount`, `paid_purchase`, `trial_purchase`) |
| Cancel | drop | `subs_cancel` / `Subs_cancel` |
| Fail | drop (Coinzy) | `subs_fail` / `Subs_fail` |

This funnel is **user-unique per step**. MVP 5 is **event-count** conversion. They will not match exactly.

---

## 9. Event inventory (`/events-explorer`)

Pick **one app** (not Compare). Queries raw `events_*`.

### Left table — all events in range (max 500, sorted by hits)

| Column | Formula |
|--------|---------|
| **Event** | `event_name_base` (suffix stripped) |
| **Hits** | `COUNT(*)` |
| **Users** | `COUNT(DISTINCT resolved_user_id)` |
| **Hits/user** | Hits ÷ users |
| **First / Last** | Min / max `event_date` for that event in the filter range |

Search filters `LOWER(event_name) LIKE %query%`.

### Right panel — one event

| Widget | Formula |
|--------|---------|
| **Headline** | Hits, unique users, hits/user for the selected event |
| **Daily hits vs unique users** | Per day: `COUNT(*)` and `COUNT(DISTINCT user)` |
| **Parameters table** | Unnested `event_params` (excludes `user_id`, `user_pseudo_id`, `ga_session_id`): name, type, example value, occurrence count (top 40) |

Use this to verify that a funnel event actually fires, and with which params (`banknote_id` / `coin_id`, `pack_name`, quota remaining, etc.).

---

## 10. Explorer tabs

Same filters. Prefer **summary tables**, then views, then raw. These are **volume / acquisition** views, not the 10 product KPIs (except DAU / retention overlap).

### Cohort LTV (`/ltv`)

| | |
|--|--|
| **Charts** | Line: LTV-30 / 90 / 180 vs install date. Bars: same three metrics by Organic / Paid / Direct |
| **Table** | `cohort_date × country × install_channel` (platform rolled up) |
| **Formula** | `revenue in days 0…N-1 after first_open ÷ installs`. N = 30, 90, 180 |
| **Country** | Country on the first `first_open` (`Unknown` / `(not set)` kept) |
| **Channel** | First-touch `traffic_source` on `first_open` → Organic / Paid / Direct |
| **Revenue** | `in_app_purchase` / `purchase` USD (`event_value_in_usd` or `value`). Not `Subs_confirm` |
| **Maturity** | LTV-N is empty until the cohort is N days old |
| **Compare** | Disabled — pick Banknote or Coinzy |

Full mapping and limitations: [09-cohort-ltv.md](./09-cohort-ltv.md).

### Daily Active Users (`/dau`)

| | |
|--|--|
| **Chart** | Line: `dau` vs `event_date` |
| **Formula** | Distinct users with **any** event that day |

Same definition as MVP 1.

### Monthly Active Users (`/mau`)

| | |
|--|--|
| **Chart** | Bar: `mau` vs `activity_month` |
| **Formula** | Distinct users in that **calendar month** (range is expanded to month start) |

### New Users (`/new-users`)

| | |
|--|--|
| **Chart** | Line: `new_users` vs `cohort_date` |
| **Formula** | Distinct users with `first_open` that day |

### D1 Retention (`/d1-retention`)

| | |
|--|--|
| **Chart** | Line: `d1_retention_rate` (shown as %) vs `cohort_date` |
| **Cohort** | `first_open` date |
| **Return** | Any activity on **cohort + 1 day** |
| **Formula** | `retained_d1 ÷ cohort_size` |
| **Note** | Cohorts whose D+1 is in the future are excluded |

### D7 Retention (`/d7-retention`)

Same as D1 with **+ 7 days**. The query reads activity through `end_date + 7`.

### Top Countries (`/countries`)

| | |
|--|--|
| **Chart** | Horizontal bars (top ~40) |
| **X** | Country name |
| **Y** | `total_new_users` |
| **Formula (raw)** | Distinct users in the date range whose resolved country is that country (`Unknown` dropped) |

The column is named `total_new_users` for historical reasons. On raw SQL it is **unique users in range by country**, not strictly `first_open`.

### Platform Split (`/platform`)

| | |
|--|--|
| **Chart** | Pie: `unique_users` by `platform` |
| **Formula** | Distinct users grouped by `LOWER(device.operating_system or platform)` |

### Top Events (`/events`)

| | |
|--|--|
| **Chart** | Horizontal bars, top 25 |
| **X** | `event_name_base` |
| **Y** | `event_count` = `COUNT(*)` (hits, not users) |

---

## 11. Admin — Users & access (`/admin/users`)

No BigQuery. MongoDB `analytics_dashboard.users`.

### Tab: Access list

| Column | Meaning |
|--------|---------|
| **Person** | Display name + username |
| **Role** | Admin (all apps/pages) or Sub-admin |
| **Apps** | Banknote / Coinzy chips (`*` = all) |
| **Pages** | Assigned page ids (or “All pages”) |
| **Email / reports** | Address + whether monthly reports are on |
| **Status** | Active or Disabled |

Search (name / username / email), filter by app, 10 rows per page. Click a row to edit.

### Tab: Create / edit

Creates or updates username, display name, email, password, role, active flag, report opt-in, **apps**, and **pages**.

Sub-admins must get ≥1 app and ≥1 page. Admins always have full access.

### Tab: Monthly reports

One email **per app** for the **previous calendar month** (auto: 1st of month 08:00 UTC).

Recipients: extra emails you list, plus users with an email and reports enabled. Sub-admins only get apps they can access. Admins get both.

Needs SMTP env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`).

---

## 12. SQL Editor (`/sql`)

Runs **your** BigQuery SQL against the **active product** project/dataset. Left pane loads files from `sql/`. Results render as a table.

Does not change dashboard KPI definitions. Use it to inspect views or debug an event.

---

## 13. How to read the numbers without fooling yourself

1. **Rates vs counts.** A 50% success rate on 10 scans is not the same as 50% on 10,000. Always glance at DAU / cohort size.
2. **Users vs events.** Funnels and catalogue rates are **users**. Identify success (MVP 3) and paywall conversion (MVP 5) are **events**.
3. **Independent funnel steps.** Later step > earlier step means people skipped instrumentation, used another entry, or events were logged out of order — not a bug in division.
4. **Same-day windows.** MVP 8 open→success is “opened Identify **and** succeeded **that calendar day**”, not a multi-day journey.
5. **Apply filters.** Country/platform empty = all. Suffix-stripped events mean Android and iOS are merged unless you filter platform.
6. **Zeros.** Missing Firebase events look like 0%, not an error. Confirm in **Event inventory**.
7. **Compare vs single-app KPI.** Compare uses the shared signals query; a single-app MVP tab may use a richer view. Small differences are expected.

---

## 14. Quick formula cheat sheet

```text
DAU                         = distinct users with any event that day
New users                   = distinct first_open that day
MAU                         = distinct users in calendar month
D1 / D7                     = returned on D+1 / D+7 ÷ first_open cohort
Day-0 first scan            = success on install day ÷ first_open cohort
Identify success            = success events ÷ (success + failure events)
Quota hit                   = quota users ÷ scan-attempt users
Paywall → purchase (MVP)    = confirm events ÷ paywall events
Paywall funnel              = distinct confirm users ÷ distinct paywall users
Scans / DAU                 = success events ÷ DAU
Open → success (MVP 8)      = distinct success users ÷ distinct Identify-open users
Catalogue open              = distinct Collection_screen ∪ Global_catalogue_screen ÷ DAU
Marketplace engagement      = distinct marketplace users ÷ DAU
Funnel step users           = distinct users who fired that step’s events in range
Funnel hop convert          = next_core.users ÷ this_core.users
Funnel hop drop             = max(0, this_core.users − next_core.users)
```

Event dictionaries and view DDL: [03-full-queries-and-events.md](./03-full-queries-and-events.md).
