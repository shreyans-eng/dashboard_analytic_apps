# Product analytics documentation index

**Start here:** [`00-project-end-to-end-flow.md`](./00-project-end-to-end-flow.md) — whole-project architecture (Firebase → BigQuery → Mongo LTV / summaries → API → UI).

| # | Doc | Length | Purpose |
|---|-----|--------|---------|
| 0 | [`00-project-end-to-end-flow.md`](./00-project-end-to-end-flow.md) | Full | **Project flow (canonical)** |
| 1 | [`01-concise-mvp-overview.md`](./01-concise-mvp-overview.md) | Short | Journey + 10 KPIs + how to use |
| 2 | [`02-concise-add-app.md`](./02-concise-add-app.md) | Short | Add a new app in 5 steps |
| 3 | [`03-full-queries-and-events.md`](./03-full-queries-and-events.md) | Full | All queries, views, events, params |
| 4 | [`04-full-remaining-work.md`](./04-full-remaining-work.md) | Full | What’s left so everything works |
| 5 | [`05-discovery-report-summary-migration.md`](./05-discovery-report-summary-migration.md) | Full | Verified BQ discovery + ambiguities |
| 6 | [`06-summary-architecture.md`](./06-summary-architecture.md) | Full | Raw → summary → dashboard |
| 7 | [`07-dashboard-tabs-and-calculations.md`](./07-dashboard-tabs-and-calculations.md) | Full | Every tab, chart, and formula |
| 8 | [`08-bigquery-cost.md`](./08-bigquery-cost.md) | Full | Query cost notes |
| 9 | [`09-cohort-ltv.md`](./09-cohort-ltv.md) | Short | LTV rules, Mongo refresh, API filters |
| 10 | [`10-cohort-ltv-full-flow.md`](./10-cohort-ltv-full-flow.md) | Short | LTV Mongo architecture checklist |
| 11 | [`11-full-system-how-it-works.md`](./11-full-system-how-it-works.md) | Full | Storage, cache, BQ, cost deep dive |
| 12 | [`deploy.md`](./deploy.md) | Full | Docker image + Render / Vercel / Netlify |

### Related (older / deeper)

- `mvp-kpi-query-guide.md` — earlier long share guide (overlaps with `03`)
- `adding-a-new-app.md` — longer add-app notes (overlaps with `02`)
- `banknote-product-metrics.md` / `product-analytics-banknote-vs-coinzy.md` — product notes
