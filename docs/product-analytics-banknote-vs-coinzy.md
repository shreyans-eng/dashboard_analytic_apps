# Product Analytics — Banknote AI vs Coinzy

> **Shareable full guide (10 KPIs + SQL for both apps):**  
> [`docs/mvp-kpi-query-guide.md`](./mvp-kpi-query-guide.md)

**Shared goal:** Measure product outcomes across  
`Acquire → Onboard → Identify → Trust → Collect → Limit → Pro → Return`

**Shared stack:** Firebase Analytics → BigQuery → dashboard.

---

## Product Analytics Focus

### Key areas

| Area | What | Why |
|------|------|-----|
| **Growth** | DAU, installs, attribution, onboarding | Right users reaching Identify? |
| **Identify** | Time to first scan, success/fail, no-match, **funnel** | Core value + where it breaks |
| **Free limits** | Quota hits, post-limit behavior | Pro pressure without angry churn |
| **Monetization** | Paywall, purchases, packs, cancels | Conversion vs store friction |
| **Retention** | D1/D7/D30, scans/user | Collector PMF |
| **Catalogue** | Opens, detail, filters | Browse loop |
| **Collection** | Add after ID | Habit vs one-off tool |
| **Marketplace** | Listings, contact seller | Commerce |
| **Feed** | Posts/likes | Secondary social |

**Not in MVP:** Free-scan variant / `scan_limit_variant` experiment (removed per product feedback).

---

## MVP KPIs (10) — both products

| # | KPI | Question |
|---|-----|----------|
| 1 | DAU | Growing? |
| 2 | Time to first scan | Reach aha? |
| 3 | Identification success rate | Identify trustworthy? |
| 4 | Quota hit rate | Free limit calibrated? |
| 5 | Paywall → purchase | Monetization converts? |
| 6 | D1 / D7 retention | Come back? |
| 7 | Scans per active user | Deep engagement? |
| 8 | Identify funnel conversion | Where does Identify break? |
| 9 | Catalogue / collection engagement | Second loop healthy? |
| 10 | Marketplace engagement | Commerce stickiness? |

SQL: `sql/dashboard/product/01`–`10_*.sql`

---

## Same vs different

| Layer | Same? | Detail |
|-------|-------|--------|
| Journey & MVP KPIs | Yes | Identical definitions |
| SQL structure | Yes | `01`–`10` + compare |
| Entity | Diff | banknote vs coin |
| ID param | Diff | `banknote_id` vs `coin_id` |
| `app_name` | Diff | Banknote vs Coinzy |

---

## Compare both apps

Sidebar **Compare** → `/compare`

| Piece | Path |
|-------|------|
| Daily dual series | `16_compare_apps_daily.sql` |
| Period scorecards | `17_compare_apps_summary.sql` |

Requires `app_name` / `app_id` containing banknote or coinzy.

---

## UI

- **Banknote | Coinzy | Compare**
- **Light | Dark**
- **Product Analytics** — journey, areas, 10 MVP KPIs
- **Compare Apps** — live side-by-side
