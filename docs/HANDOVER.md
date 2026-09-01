# Analytics dashboard — handover

**Audience:** product / engineering manager.  
**Detail (formulas, SQL, deploy):** [PROJECT.md](PROJECT.md).  
**Live:** `http://localhost:5173` (API `:3001`). Production is on Render.

---

## What this is

A custom analytics dashboard for the identification apps. Today that is **Banknote** (paper money) and **Coinzy** (coins). Both products share the same journey:

**Acquire → Onboard → Identify → Trust → Collect → Limit → Pro → Return**

The two apps **never share a query**. Compare runs the same KPI on each BigQuery project and puts the results side by side. A third app can be added the same way.

Firebase is the source of events. BigQuery `events_*` is the source of truth. Expensive tables are refreshed once a day so people clicking the dashboard do not re-scan raw logs.

---

## How to tell the apps apart

| | Banknote | Coinzy |
|--|----------|--------|
| Color | **Mint** `#30ED9D` | **Wine** `#c9787a` |
| Ink | Teal `#0C2525` | Wine `#7C3C3F` |
| Compare gold | Shared accent `#F0A924` when viewing both |

The sidebar stripe, product switcher, Compare charts, and KPI lines use these colors. Switching product changes the chrome so it is obvious which app you are looking at.

---

## What to open for a question

| Question | Where |
|----------|--------|
| Are people opening the app? | MVP **1. DAU** — `session_start` / `App_open` / `first_open` only. Push is **not** DAU. |
| Do new installs scan the same day? | MVP **2** |
| Is Identify quality good? | MVP **3** (success vs fail **events**) |
| Are people hitting the free scan cap? | MVP **4**, or Coinzy **Free-scan success quota** |
| Does the paywall convert? | MVP **5** (event counts). Unique people: **Funnels → Paywall** |
| Which pack did they take? | **Subscriptions → Packs taken** — [PACKS-TAKEN.md](PACKS-TAKEN.md) |
| Do they come back? | MVP **6** and Explorer **D1 / D7**. Return = opened the app, **not** a push. |
| How many successful IDs per person? | MVP **7** — average **and** percentiles include people with **0** scans |
| Identify drop-off | **Funnels → Identify** (not tab 3) |
| Collection vs catalogue | Two separate rates. Do **not** mix. |
| Marketplace vs Feed | Two separate tabs. Do **not** mix. |
| Banknote vs Coinzy on the same KPI | **Compare Apps** |
| Written snapshot | **Health report** |
| “Does this event fire?” | **Event inventory** / **Event catalog** |

---

## Rules that keep numbers honest

1. **DAU = opened the app.** Notification display is a separate series.
2. **D1 / D4 / D7 return** = opened the app that offset day (`session_start` / `App_open` / `first_open`). Push does not count.
3. **Scans / user percentiles** include the whole DAU, including zeros. “Average / scanner” is the scanners-only mean.
4. **Time-spent percentiles** include zeros (all installs / D1 openers). “Went in” (≥10 seconds) is a separate rate.
5. **Funnels count unique people per step**, not ordered sessions. A later step can be larger than an earlier one (another entry, or missing events).
6. **LTV-N** = IAP USD in N days after install ÷ installs. Immature cohorts are empty, not partial. Revenue is store purchase USD, not `Subs_confirm`.
7. Incomplete Firebase export days are **omitted**, never shown as zero.

---

## How a number is loaded (cost)

```text
Click → cache → daily summary table → product view → raw events_*
LTV → MongoDB only (BigQuery only in an emergency)
```

Pay BigQuery **once per day** on refresh. Dashboard clicks should hit summaries or Mongo.

After the Firebase daily export (often 08:00–10:00 UTC):

```bash
cd banknote-analytics-dashboard
PRODUCTS=banknote,coinzy DAYS=90 npm run refresh-summaries:product
PRODUCTS=banknote,coinzy DAYS=30 LTV_DAYS=210 npm run refresh-ltv:mongo
```

---

## Adding another app

The registry is already multi-app (`PRODUCTS=banknote,coinzy,…`). Compare, the switcher, and catalog filters iterate whatever is registered.

1. Service account JSON in `secrets/`.
2. `.env`:

```bash
PRODUCTS=banknote,coinzy,YOURAPP
PRODUCT_YOURAPP_LABEL=YourApp
PRODUCT_YOURAPP_GCP_PROJECT=…
PRODUCT_YOURAPP_BQ_DATASET=analytics_XXXXXXXXX
PRODUCT_YOURAPP_GOOGLE_APPLICATION_CREDENTIALS=../secrets/yourapp-sa.json
PRODUCT_YOURAPP_COLOR=#a78bfa
```

3. Optional polish: name, tagline, logo in `src/lib/product.tsx` (`PRODUCT_CATALOG`) and `public/brands/yourapp.png`.
4. Optional product SQL under `sql/dashboard/product/yourapp/` (same filenames as Banknote).
5. Optional funnel event lists in `funnel-registry.js`.
6. Restart the dashboard. No two-app hardcoding in the shell.

Keep each app in its **own** GCP project / dataset. Never union `events_*` across apps.

---

## Access and deploy

- Login is Mongo users. Sub-admins need at least one app and one page. Compare needs more than one app.
- Production: Render (see PROJECT.md §12). Secrets: Mongo URI, auth secret, both Google credential JSONs.
- Local: `cd banknote-analytics-dashboard && npm run setup && npm install && npm run dev`

---

## Known limits (do not treat as bugs until checked)

| Topic | Reality |
|-------|---------|
| Catalogue % of DAU | Some paths still use a wider “any event” DAU than app-open DAU |
| Coinzy gallery | No gallery-tap event; gallery is inferred |
| Coinzy add-to-collection after ID | Not measurable on a live success event |
| Identify “previous step” | Table is linear on core rows; people can join mid-path |
| Retention summary table | Historically counted any event. Live D1/D4/D7 uses raw app-open SQL until that summary is rebuilt |

Empty charts usually mean **the event is not firing**, not that the API is down. Prove it in Event inventory.

---

## Who owns what in the repo

| Path | Role |
|------|------|
| `banknote-analytics-dashboard/` | UI + API |
| `sql/dashboard/` | KPI and explorer SQL |
| `sql/scheduled/` | Daily materialize |
| `docs/PROJECT.md` | Formulas, events, env, deploy |
| `docs/TABS-AND-EVENTS.html` | Tab ↔ event map |

Stack: Vite + React, Express, BigQuery, MongoDB (auth + LTV), in-memory or Redis cache.
