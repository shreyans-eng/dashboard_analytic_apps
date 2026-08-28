# Banknote AI Analytics Dashboard

Custom analytics dashboard for **Banknote** and **Coinzy** — Vite + React + Express + BigQuery + MongoDB.

> **Stack:** Vite · React 18 · TanStack Query · Recharts · Express · BigQuery · MongoDB (auth + Cohort LTV)

**Start here:** [docs/00-project-end-to-end-flow.md](../docs/00-project-end-to-end-flow.md) · index [docs/ANALYTICS-DOCS.md](../docs/ANALYTICS-DOCS.md)

---

## Features

| Area | Description |
|------|-------------|
| **MVP KPIs** | Product journey metrics (DAU, funnels, quota, …) |
| **Explorer** | DAU, MAU, retention, countries, events, … |
| **Cohort LTV** | LTV-30/90/180 from MongoDB (daily BQ→Mongo refresh) |
| **Compare** | Banknote vs Coinzy side-by-side |
| **Funnels** | Multi-step conversion |
| **SQL Editor** | Ad-hoc BigQuery (careful with cost) |
| **Auth** | MongoDB users + page access |

---

## Prerequisites

- Node.js 18+
- BigQuery SA JSON:
  - Banknote: `../secrets/bigquery-banknote-sa.json`
  - Coinzy: `../secrets/coinzy-analytics-dashboard-sa.json`
- `MONGODB_URI` (users + `cohort_ltv` collection)

---

## Quick start

```bash
cd banknote-analytics-dashboard
npm run setup
npm install
npm run dev
```

Open **http://localhost:5173** (API on **:3001**).

### Daily jobs (after Firebase export)

```bash
PRODUCTS=banknote,coinzy DAYS=90 npm run refresh-summaries:product
PRODUCTS=banknote,coinzy DAYS=30 LTV_DAYS=210 npm run refresh-ltv:mongo
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run setup` | Create `.env`, find service account key |
| `npm run dev` | API + Vite |
| `npm run refresh-summaries:product` | BQ → `analytics_summary` |
| `npm run refresh-ltv:mongo` | BQ read → MongoDB `cohort_ltv` |

---

## SQL layout (repo root `sql/`)

```text
sql/dashboard/summary/   ← cheap dashboard reads
sql/dashboard/raw/       ← expensive fallbacks
sql/dashboard/product/   ← MVP / product SQL
sql/scheduled/           ← summary + LTV SELECT refresh
sql/validation/          ← QA checks
```

---

## Deploy

See [`docs/deploy.md`](../docs/deploy.md).

```bash
# from repo root
docker build -t banknote-analytics .
docker compose up --build
```
