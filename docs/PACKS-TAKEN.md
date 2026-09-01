# Packs taken — what we measure and why

**Audience:** product / engineering manager  
**Dashboard:** Subscriptions → **Packs taken** (`/packs`)  
**SQL:** `sql/dashboard/product/banknote/18_subscription_packs.sql` · `sql/dashboard/product/coinzy/18_subscription_packs.sql`

This tab answers: **which subscription pack unique people actually took**, per app, per day.

It does **not** replace paywall conversion (MVP 5 / Funnels → Paywall) and it is **not** App Store / Play settled revenue.

---

## Why this exists

Store `in_app_purchase` buckets (Monthly / Yearly / Lifetime) do not match how users pick a pack in the app. Banknote and Coinzy also fire **different event names**, so one shared definition mixed the two products.

Packs taken uses **each app’s own taken event + pack SKU**, unique people. Banknote taken is store `in_app_purchase`. Coinzy taken is in-app confirm.

---

## How to read the numbers

| Number | Meaning |
|--------|---------|
| **Unique people** | Distinct people who **took** a pack. One person per calendar day (Banknote: store purchase; Coinzy: confirm). |
| **Yearly / half-yearly / monthly / lifetime** | Those people, split by pack kind. Half-yearly SKUs are **not** lumped into yearly. Coinzy lifetime is a **one-time IAP**, not a subscription. |
| **Takes / confirm taps** | Raw confirm taps, including payment retries. Useful for friction; **not** the people count. |
| **Confirms / person** | Takes ÷ unique people. Above **1.0** means retries / double-taps. |
| **Click → confirm** | Unique confirmers ÷ unique people who **tapped a pack**. Can be over 100% if confirm fires without a pack-click event. |
| **Yearly estimated $** | Unique **full yearly** people × **20% × Play US list**. Banknote **$22.99** (`yearly_banknote_pack`). Coinzy **$23.99**. Not tax, refunds, or store payout. |
| **Half-yearly / offer estimated $** | Unique **offer** people × **20% × discounted Play US list**. Banknote **$11.99** (`yearly_banknote_pack_offer`). Coinzy half SKUs still use **$23.99** until a Play price is set. |
| **Full vs half vs trial** | Coinzy only — from the live SKU JSON (see below). |

Compare Apps runs the **same query on each product** and puts the results side by side. The two BigQuery projects are never unioned.

---

## Events (do not mix apps)

| Step | Banknote | Coinzy |
|------|----------|--------|
| Pack click | `Subs_pack` | `subs_pack`, `subs_pack_discount` |
| Confirm / taken | Store `in_app_purchase` product ID (`items.item_id`) | `subs_confirm`, `subs_confirm_discount`, `paid_purchase`, `trial_purchase` |

**Banknote pack name** is the store Product ID on `in_app_purchase` (same as GA4 In-app purchases). `Subs_confirm` is not counted — people tap Confirm without a store purchase. `Subs_pack` is only used for click → confirm.

**Coinzy pack name** comes from confirm params (`pack_name` / `product_id` / `item_id` / `item_name`). If confirm has no name, we use that day’s **last named pack click**.

Onboarding paywall (`subscription_shown` / `Subs_page_onboarding`) is **not** in this tab.

---

## Coinzy SKUs (from paywall JSON)

Offer groups (`full_pack`, `half_pack`, …) are **which wall is shown**. Mix is **which SKU they confirmed**. Analytics must log the SKU, not only the group name.

| Offer group | SKU | Kind | Store type |
|-------------|-----|------|------------|
| `full_pack` | `yearly_coin_pack` | Yearly | SUBS |
| `full_pack` | `monthly_coin_pack` | Monthly | SUBS |
| `full_pack` | `lifetime_coin` | Lifetime | IAP |
| `half_pack` | `yearly_coin_half_pack` | Yearly | SUBS |
| `half_pack` | `lifetime_pack_half_price` | Lifetime | IAP |
| `full_pack1` | `yearly_coinzy_pack_trial` | Yearly | SUBS |
| `full_pack1` | `monthly_coin_pack` | Monthly | SUBS |
| `half_pack1` | `yearly_coinzy_pack_trial_half_price` | Yearly | SUBS |
| `half_pack1` | `monthly_coin_pack` | Monthly | SUBS |

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
3. Pack clicks → last named SKU that day (for naming confirms that have no pack name) **and** distinct pack clickers (for click → confirm).
4. Confirms → attach SKU; classify Yearly / Monthly / Lifetime.
5. Collapse to **one row per person per day** (last pack that day). Extra confirms stay as `takes`.
6. Output:
   - each SKU’s unique people
   - rollups: `(all packs)`, `(yearly)`, `(monthly)`, `(lifetime)`, `(pack clicks)`

```text
Pack click (unique people)     Confirm (unique people)
        │                              │
        │     last named SKU that day  │
        └────────────► pack name ◄─────┘
                       │
                       ▼
              one person per day
              Yearly | Monthly | Lifetime
```

---

## Query (Coinzy)

Live file: `sql/dashboard/product/coinzy/18_subscription_packs.sql`  
Banknote is the same output shape; taken is `in_app_purchase` product ID, not `Subs_confirm`. File: `sql/dashboard/product/banknote/18_subscription_packs.sql`.

```sql
-- Coinzy packs taken — unique people per day per pack
-- Placeholders {{...}} are filled by the dashboard API.

WITH base AS (
  SELECT
    PARSE_DATE('%Y%m%d', event_date) AS event_date,
    event_timestamp,
    {{resolved_user_id_cheap}} AS uid,
    REGEXP_REPLACE(event_name, r'_(android|ios)$', '') AS event_name_base,
    COALESCE(
      NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'pack_name'), ''),
      NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'product_id'), ''),
      NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'item_id'), ''),
      NULLIF((SELECT ep.value.string_value FROM UNNEST(event_params) ep WHERE ep.key = 'item_name'), ''),
      '(unnamed pack)'
    ) AS pack_name
  FROM `{PROJECT}.{DATASET}.events_*`
  WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', {{start_date}})
                          AND FORMAT_DATE('%Y%m%d', {{end_date}})
    AND _TABLE_SUFFIX NOT LIKE 'intraday_%'
    AND REGEXP_CONTAINS(_TABLE_SUFFIX, r'^\d{8}$')
),

pack_clicks AS (
  SELECT
    event_date,
    uid,
    ARRAY_AGG(
      IF(pack_name = '(unnamed pack)', NULL, pack_name) IGNORE NULLS
      ORDER BY event_timestamp DESC
      LIMIT 1
    )[SAFE_OFFSET(0)] AS pack_name
  FROM base
  WHERE uid IS NOT NULL
    AND event_name_base IN ('subs_pack', 'subs_pack_discount')
  GROUP BY event_date, uid
),

click_people AS (
  SELECT DISTINCT event_date, uid
  FROM base
  WHERE uid IS NOT NULL
    AND event_name_base IN ('subs_pack', 'subs_pack_discount')
),

confirms AS (
  SELECT
    event_date,
    event_timestamp,
    uid,
    pack_name,
    CASE
      WHEN REGEXP_CONTAINS(pk, r'lifetime_pack_half_price|lifetime_coin') THEN 'Lifetime'
      WHEN REGEXP_CONTAINS(pk, r'yearly_coinzy_pack_trial_half_price|yearly_coinzy_pack_trial|yearly_coin_half_pack|yearly_coin_pack') THEN 'Yearly'
      WHEN REGEXP_CONTAINS(pk, r'monthly_coin_pack') THEN 'Monthly'
      WHEN REGEXP_CONTAINS(pk, r'lifetime|life_time|life.?time') THEN 'Lifetime'
      WHEN REGEXP_CONTAINS(pk, r'yearly|year|annual') THEN 'Yearly'
      WHEN REGEXP_CONTAINS(pk, r'monthly|month') THEN 'Monthly'
      ELSE 'Other'
    END AS pack_kind
  FROM (
    SELECT
      c.event_date,
      c.event_timestamp,
      c.uid,
      COALESCE(NULLIF(c.pack_name, '(unnamed pack)'), p.pack_name, '(unnamed pack)') AS pack_name,
      LOWER(COALESCE(NULLIF(c.pack_name, '(unnamed pack)'), p.pack_name, '')) AS pk
    FROM base c
    LEFT JOIN pack_clicks p
      ON p.event_date = c.event_date AND p.uid = c.uid
    WHERE c.uid IS NOT NULL
      AND c.event_name_base IN (
        'subs_confirm', 'subs_confirm_discount',
        'paid_purchase', 'trial_purchase'
      )
  )
),

taken AS (
  SELECT
    event_date,
    uid,
    ARRAY_AGG(pack_name ORDER BY event_timestamp DESC LIMIT 1)[SAFE_OFFSET(0)] AS pack_name,
    ARRAY_AGG(pack_kind ORDER BY event_timestamp DESC LIMIT 1)[SAFE_OFFSET(0)] AS pack_kind,
    COUNT(*) AS confirm_taps
  FROM confirms
  GROUP BY event_date, uid
)

-- Then UNION ALL:
--   per pack (day + range)
--   (all packs), (yearly), (monthly), (lifetime)
--   (pack clicks) from click_people
SELECT
  'range' AS grain,
  pack_name,
  pack_kind,
  COUNT(DISTINCT uid) AS unique_users,
  SUM(confirm_taps) AS takes
FROM taken
GROUP BY pack_name, pack_kind;
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
- Estimated yearly = **$4.80** (1 × 20% × $23.99). Banknote full = **$4.60** (1 × 20% × $22.99). Banknote discounted offer = **$2.40** (1 × 20% × $11.99).

That is why unique people is the headline, not confirm event count.
