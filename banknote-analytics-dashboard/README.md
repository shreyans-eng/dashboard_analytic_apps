# Banknote AI Analytics Dashboard

Vite + React + Express + BigQuery + MongoDB for **Banknote** and **Coinzy**.

**Full project guide:** [docs/PROJECT.md](../docs/PROJECT.md)

---

## Quick start

```bash
cd banknote-analytics-dashboard
npm run setup
npm install
npm run dev
```

Open **http://localhost:5173** (API **:3001**). Node 18+, SA JSON in `../secrets/`, `MONGODB_URI`.

### Daily jobs (after Firebase export)

```bash
PRODUCTS=banknote,coinzy DAYS=90 npm run refresh-summaries:product
PRODUCTS=banknote,coinzy DAYS=30 LTV_DAYS=210 npm run refresh-ltv:mongo
```

| Command | Description |
|---------|-------------|
| `npm run setup` | Create `.env`, find service-account key |
| `npm run dev` | API + Vite |
| `npm run refresh-summaries:product` | BQ → `analytics_summary` |
| `npm run refresh-ltv:mongo` | BQ read → Mongo `cohort_ltv` |
| `npm test` | Unit tests |

```bash
# from repo root
docker build -t banknote-analytics .
docker compose up --build
```
