# Analytics — Concise overview

**Stack:** Firebase → BigQuery → dashboard (`banknote-analytics-dashboard/`)  
**Apps today:** Banknote (`banknote-app-4f3fd`) · Coinzy (`coinzy-26a4d`)  
**Add more:** set `PRODUCTS=…` in `.env` (see concise add-app doc)

## Journey

`Acquire → Onboard → Identify → Trust → Collect → Limit → Pro → Return`

## 10 MVP KPIs (sidebar → MVP KPIs)

| # | KPI | One-line meaning |
|---|-----|------------------|
| 1 | DAU | Active users / day |
| 2 | Time to first scan | How fast to first successful ID |
| 3 | Identify success | success ÷ (success + failure) |
| 4 | Quota hit | Free-limit pressure |
| 5 | Paywall → purchase | Monetization conversion |
| 6 | D1 / D7 retention | Do they come back? |
| 7 | Scans / user | Engagement depth |
| 8 | Identify funnel | Open → success |
| 9 | Catalogue | Browse / collection loop |
| 10 | Marketplace | Commerce loop |

## How to use

1. Sidebar: pick **Banknote** or **Coinzy** (or Compare).
2. Open any **MVP KPIs (10)** tab for that app.
3. Filter date / country / platform → **Apply**.

## Must-log events (short)

`first_open` · `Identify_open` · `identification_done_success` / `_failure` · quota (`Identified_limit_reached`) · `Subs_page` → `Subs_confirm` · `Collection_open` · `Marketplace_open`

## Docs

| Doc | Type |
|-----|------|
| This file | Concise overview |
| `docs/02-concise-add-app.md` | Concise: add a new app |
| `docs/03-full-queries-and-events.md` | Full: all queries + events |
| `docs/04-full-remaining-work.md` | Full: what’s left so everything works |
