# Packs taken — what we measure and why

**Audience:** product / engineering manager  
**Dashboard:** Subscriptions → **Packs taken** (`/packs`)  
**SQL:** `sql/dashboard/product/banknote/18_subscription_packs.sql` · `sql/dashboard/product/coinzy/18_subscription_packs.sql`

This tab answers: **which subscription pack unique people actually took**, per app, per day.

It does **not** replace paywall conversion (MVP 5 / Funnels → Paywall) and it is **not** App Store / Play settled revenue.

---

## Why this exists

Store `in_app_purchase` buckets (Monthly / Yearly / Lifetime) do not match how users pick a pack in the app. Banknote and Coinzy also fire **different event names**, so one shared definition mixed the two products.

Packs taken uses **each app’s store product ID** (`in_app_purchase` / `purchase` → `items.item_id`), unique people. In-app confirm taps (`Subs_confirm` / `subs_confirm`) are **not** counted — people tap Confirm without a store purchase.

---

## How to read the numbers

| Number | Meaning |
|--------|---------|
| **Unique people** | Distinct people who **bought** a pack in the store. One person per calendar day per SKU. |
| **Yearly / half-yearly / monthly / lifetime** | Those people, split by pack kind. Half-yearly SKUs are **not** lumped into yearly. Coinzy lifetime is a **one-time IAP**, not a subscription. |
| **Takes / confirm taps** | Raw store purchase events, including retries. Useful for friction; **not** the people count. |
| **Confirms / person** | Takes ÷ unique people. Above **1.0** means retries / double-taps. |
| **Click → confirm** | Unique buyers ÷ unique people who **tapped a pack**. Can be over 100% if a store purchase fires without a pack-click event. |
| **Yearly estimated $** | Unique **full yearly** people × **share × Play US list**. Banknote **20% × $22.99**. Coinzy **15% × $29.99**. Not tax, refunds, or store payout. Monthly and lifetime have **no** estimated $. |
| **Half-yearly / offer estimated $** | Unique **offer** people × the same yearly share × discounted Play US list. Banknote **20% × $11.99**. Coinzy **15% × $14.99**. |
| **Monthly / lifetime** | People counts only. No % of list. Coinzy list prices (Play US): monthly **$4.49**, lifetime **$54.99**, lifetime half **$26.99**. |
| **Full vs half vs trial** | Coinzy only — from the live SKU JSON (see below). |

Compare Apps runs the **same query on each product** and puts the results side by side. The two BigQuery projects are never unioned.

---

## Events (do not mix apps)

| Step | Banknote | Coinzy |
|------|----------|--------|
| Pack click | `Subs_pack` | `subs_pack`, `subs_pack_discount` |
| Confirm / taken | Store `in_app_purchase` product ID (`items.item_id`) | Store `in_app_purchase` product ID (`items.item_id`) |

**Banknote pack name** is the store Product ID on `in_app_purchase` (same as GA4 In-app purchases). `Subs_confirm` is not counted — people tap Confirm without a store purchase. `Subs_pack` is only used for click → confirm.

**Coinzy pack name** is the store Product ID on `in_app_purchase` (same as GA4). `subs_confirm` / `paid_purchase` are not counted. `subs_pack` is only used for click → confirm. Expert tokens (`coinzy_expert_token`) are not subscription packs.

Onboarding paywall (`subscription_shown` / `Subs_page_onboarding`) is **not** in this tab.

---

## Coinzy SKUs (from paywall JSON)

Offer groups (`full_pack`, `half_pack`, …) are **which wall is shown**. Mix is **which store SKU they bought**. Analytics must use the product ID, not only the group name.

| Offer group | SKU | Kind | Store type | Play US list |
|-------------|-----|------|------------|-------------:|
| `full_pack` | `yearly_coin_pack` | Yearly | SUBS | $29.99 |
| `full_pack` | `monthly_coin_pack` | Monthly | SUBS | $4.49 |
| `full_pack` | `lifetime_coin` | Lifetime | IAP | $54.99 |
| `half_pack` | `yearly_coin_half_pack` | Yearly | SUBS | $14.99 |
| `half_pack` | `lifetime_pack_half_price` | Lifetime | IAP | $26.99 |
| `full_pack1` | `yearly_coinzy_pack_trial` | Yearly | SUBS | $29.99 |
| `full_pack1` | `monthly_coin_pack` | Monthly | SUBS | $4.49 |
| `half_pack1` | `yearly_coinzy_pack_trial_half_price` | Yearly | SUBS | $14.99 |
| `half_pack1` | `monthly_coin_pack` | Monthly | SUBS | $4.49 |

- **Yearly** = full-price yearly SKUs (`yearly_coin_pack`, `yearly_coinzy_pack_trial`).
- **Half-yearly** = half-price yearly SKUs (`yearly_coin_half_pack`, `yearly_coinzy_pack_trial_half_price`).
- **Monthly mix** = `monthly_coin_pack`.
- **Lifetime** is listed separately (IAP).
- If the event only says `full_pack` / `half_pack`, we cannot tell yearly from monthly.

Banknote has no Coinzy-style half pack JSON. GA Product IDs for August 2026:

| SKU | Kind |
|-----|------|
| `yearly_banknote_pack` | Yearly |
| `yearly_banknote_pack_offer` | Yearly offer (listed with half-yearly) |
| `monthly_banknote_pack` | Monthly |
| `lifetime_banknote_pack_offer` | Lifetime |

Yearly IAP often shows **$0** in GA (trial start) but still has quantity — we count unique people, not store USD.

---

## Query logic (plain English)

1. Read Firebase `events_*` for the date range (and optional country / platform). Strip `_android` / `_ios` from event names.
2. Resolve the person (`user_id` → param `user_id` → `user_pseudo_id`; skip anonymous).
3. Pack clicks → distinct pack clickers (for click → confirm). Not used to name the pack taken.
4. Store purchases → SKU from `items.item_id`; classify Yearly / Monthly / Lifetime. Known Coinzy SKUs only (no expert tokens).
5. Collapse to **one row per person per day per SKU**. Extra purchase events stay as `takes`.
6. Output:
   - each SKU’s unique people
   - rollups: `(all packs)`, `(yearly)`, `(monthly)`, `(lifetime)`, `(pack clicks)`

```text
Pack click (unique people)     Store purchase (unique people)
        │                              │
        │                              SKU = items.item_id
        │                              │
        └──────── click → confirm ─────┘
                       │
                       ▼
              one person per day per SKU
              Yearly | Monthly | Lifetime
```

---

## Query (Coinzy)

Live file: `sql/dashboard/product/coinzy/18_subscription_packs.sql`  
Banknote is the same output shape. File: `sql/dashboard/product/banknote/18_subscription_packs.sql`.

Taken = `in_app_purchase` / `purchase` (`items.item_id`). Known Coinzy SKUs only. Pack click stays `subs_pack` / `subs_pack_discount`.

```sql
purchases AS (
  SELECT event_date, uid, pack_name, pack_kind
  FROM base
  WHERE uid IS NOT NULL
    AND event_name_base IN ('in_app_purchase', 'purchase')
    AND pack_name != '(unnamed pack)'
    AND REGEXP_CONTAINS(LOWER(pack_name),
      r'yearly_coinzy_pack_trial|yearly_coin_half_pack|yearly_coin_pack|monthly_coin_pack|lifetime_pack_half_price|lifetime_coin')
),
taken AS (
  SELECT event_date, uid, pack_name, pack_kind, COUNT(*) AS confirm_taps
  FROM purchases
  GROUP BY event_date, uid, pack_name, pack_kind
)
-- UNION ALL: per SKU (day + range), (all packs), (yearly), (monthly), (lifetime), (pack clicks)
```

**Banknote differences in the same query**

- Pack click: `event_name_base = 'Subs_pack'` (click → confirm only)
- Taken: `in_app_purchase` / `purchase` only — `items.item_id` (GA Product ID). **Not** `Subs_confirm`
- SKUs: `yearly_banknote_pack`, `yearly_banknote_pack_offer`, `monthly_banknote_pack`, `lifetime_banknote_pack_offer`

---

## What this is not

| Question | Use instead |
|----------|-------------|
| Of people who **saw** the in-app paywall, how many confirmed? | MVP **5** / Funnels → Paywall |
| Onboarding → subscribe | Funnels → Onboarding → subscription |
| Store cash collected | Explorer **LTV** (`in_app_purchase` USD) |
| Which pack they **tapped** but did not confirm | Funnels → Paywall pack mix table |

---

## Example

Same person taps Confirm three times on 1 Sep (payment retry), last pack `yearly_coin_pack`:

- Unique people that day = **1**
- Takes = **3**
- Yearly unique = **1**
- Estimated yearly = **$4.50** (1 × 15% × $29.99). Coinzy half yearly = **$2.25** (1 × 15% × $14.99). Banknote full = **$4.60** (1 × 20% × $22.99). Banknote discounted offer = **$2.40** (1 × 20% × $11.99). Monthly and lifetime are not estimated.

That is why unique people is the headline, not confirm event count.
