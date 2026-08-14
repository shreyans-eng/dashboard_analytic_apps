# Banknote AI Analytics Dashboard

Custom analytics dashboard for **Banknote AI** — built with **Vite + React + TypeScript**, connected to Firebase Analytics data in BigQuery.

> **Stack:** Vite · React 18 · TanStack Query · Recharts · Express · AnalyticsRepository · BigQuery summary tables

Production architecture: [docs/production-architecture.md](../docs/production-architecture.md)

Branded, embeddable dashboard with sidebar navigation, multi-app (Banknote / Coinzy / Compare), and a full **SQL Editor**.

---

## Features

| Feature | Description |
|---------|-------------|
| **Executive Dashboard** | KPI cards only (1 cached query) |
| **Engagement** | DAU + MAU charts |
| **Retention** | D1 and D7 cohort trends |
| **Acquisition** | New users, countries, platform split |
| **Feature Usage** | Top Firebase events |
| **SQL Editor** | Run any BigQuery SQL; load queries from `../sql/` |
| **Filters** | Date range, Country, Platform (all pages) |
| **Sidebar navigation** | Click between dashboard sections |

---

## Prerequisites

- Node.js 18+
- BigQuery service account JSON at `../secrets/bigquery-metabase-sa.json`
- Deployed BigQuery views (`v_daily_active_users`, etc.)
- Summary tables populated via `npm run refresh-summaries` (see [production architecture](../docs/production-analytics-architecture.md))

---

## Quick start

```bash
cd banknote-analytics-dashboard

# One-time setup (creates .env, locates service account)
npm run setup

# If no service account found, place JSON at:
#   ../secrets/bigquery-metabase-sa.json
# Then run setup again.

# Install dependencies
npm install

# Start both API (:3001) and UI (:5173)
npm run dev

# First time: populate summary tables (run daily after Firebase export)
npm run refresh-summaries
```

Open: **http://localhost:5173**

### Scripts

| Command | Description |
|---------|-------------|
| `npm run setup` | Create `.env`, find service account key |
| `npm run dev` | Start API + Vite dev server |
| `npm run server` | API only (port 3001) |
| `npm run dev:client` | Vite only (port 5173) |
| `npm run build` | Production frontend build |
| `npm run start:prod` | Build + serve API with static files |
| `npm run refresh-summaries` | Create/refresh BigQuery summary tables |

---

## Project structure

```
banknote-analytics-dashboard/
├── server/index.js          # Express API → BigQuery
├── src/
│   ├── pages/               # Dashboard pages (sidebar routes)
│   │   ├── ExecutivePage.tsx
│   │   ├── EngagementPage.tsx
│   │   ├── RetentionPage.tsx
│   │   ├── AcquisitionPage.tsx
│   │   ├── FeaturesPage.tsx
│   │   └── SqlEditorPage.tsx
│   ├── components/          # Layout, filters, charts
│   └── lib/api.ts           # API client
├── vite.config.ts           # Vite build + API proxy
└── package.json
```

SQL queries are loaded from the parent repo:

```
../sql/dashboard/     ← Dashboard chart queries
../sql/validation/    ← QA queries
../sql/queries/       ← Ad-hoc queries
```

---

## Sidebar navigation

```
Banknote AI Analytics
├── Executive          → /           (main KPI dashboard)
├── Retention          → /retention
├── Acquisition        → /acquisition
├── Feature Usage      → /features
└── SQL Editor         → /sql       (write & run SQL)
```

---

## SQL Editor

The SQL Editor page lets you:

1. **Write custom BigQuery SQL** in the textarea
2. **Load pre-built queries** from the left panel (`dashboard/`, `validation/`, `queries/`)
3. **Run queries** against `banknote-app-4f3fd.analytics_488476338`
4. **View results** in a table

Template syntax is supported:
- `{{start_date}}` / `{{end_date}}` → replaced from filter bar
- `[[AND country = {{country}}]]` → optional filters

Example:

```sql
SELECT event_date, COUNT(DISTINCT resolved_user_id) AS dau
FROM `banknote-app-4f3fd.analytics_488476338.v_daily_active_users`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
GROUP BY event_date
ORDER BY event_date;
```

---

## Production build

```bash
npm run build     # → dist/
NODE_ENV=production npm run server   # API + static files on :3001
```

**Docker / Render / Vercel / Netlify:** see [`docs/deploy.md`](../docs/deploy.md).

```bash
# from repo root
docker build -t banknote-analytics .
docker compose up --build
```

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GCP_PROJECT` | `banknote-app-4f3fd` | BigQuery project |
| `BQ_DATASET` | `analytics_488476338` | Firebase export dataset |
| `GOOGLE_APPLICATION_CREDENTIALS` | `../secrets/...json` | Service account key |
| `PORT` | `3001` | API server port |

---

## Why Vite + React (not Next.js)?

You requested Vite as the build tool. **Next.js uses its own bundler** (Webpack/Turbopack), not Vite. This project uses:

- **Vite** — fast dev server and production builds
- **React Router** — file-based page navigation (same UX as Next.js App Router pages)
- **Express API** — BigQuery queries (server-side, credentials never exposed to browser)

If you need SSR/SSG later, migrate pages to Next.js App Router and move the Express API to Next.js Route Handlers.

---

## Related docs

| Doc | Location |
|-----|----------|
| Analytics docs index | `../docs/ANALYTICS-DOCS.md` |
| Full analytics workflow | `../docs/analytics-workflow.md` |
| View schema | `../docs/view-schema.md` |
