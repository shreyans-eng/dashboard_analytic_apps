# Deploy the analytics dashboard

The app is **one Node process**: Express serves `/api/*` (BigQuery) and the Vite SPA from `dist/`. SQL files live in `sql/` next to the dashboard package.

**Use Docker on Render (or Cloud Run / a VM).** Vercel and Netlify are static/serverless hosts — they do not fit this architecture as a single project. Steps for all three are below.

---

## What you need

| Item | Where |
|------|--------|
| This Git repo (must include `sql/` **and** `banknote-analytics-dashboard/`) | GitHub / GitLab |
| Banknote BigQuery SA JSON | `secrets/bigquery-metabase-sa.json` locally |
| Coinzy BigQuery SA JSON | `secrets/coinzy-analytics-dashboard-sa.json` locally |
| Dashboard login | username + password + `AUTH_SECRET` |

Never commit SA JSON or `.env`. On hosts, paste JSON into **secret env vars**.

---

## 1. Docker image (local)

From the **repo root** (`bigdata/`, the folder that contains `sql/` and `banknote-analytics-dashboard/`):

```bash
docker build -t banknote-analytics .
```

### Run with mounted keys (local)

```bash
docker run --rm -p 3001:3001 \
  --env-file banknote-analytics-dashboard/.env \
  -e NODE_ENV=production \
  -e HOST=0.0.0.0 \
  -e SQL_ROOT=/sql \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/secrets/banknote-sa.json \
  -e COINZY_GOOGLE_APPLICATION_CREDENTIALS=/app/secrets/coinzy-sa.json \
  -v "$(pwd)/secrets/bigquery-metabase-sa.json:/app/secrets/banknote-sa.json:ro" \
  -v "$(pwd)/secrets/coinzy-analytics-dashboard-sa.json:/app/secrets/coinzy-sa.json:ro" \
  banknote-analytics
```

Or:

```bash
docker compose up --build
```

Open **http://localhost:3001** (login with `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`).

Live check: `curl -s http://localhost:3001/api/live`

### Run with JSON in env (same as Render)

```bash
docker run --rm -p 3001:3001 \
  -e NODE_ENV=production \
  -e PRODUCTS=banknote,coinzy \
  -e GCP_PROJECT=banknote-app-4f3fd \
  -e BQ_DATASET=analytics_488476338 \
  -e BQ_SUMMARY_DATASET=analytics_summary \
  -e USE_SUMMARY_TABLES=true \
  -e COINZY_GCP_PROJECT=coinzy-26a4d \
  -e COINZY_BQ_DATASET=analytics_487601380 \
  -e COINZY_BQ_SUMMARY_DATASET=analytics_summary \
  -e COINZY_USE_SUMMARY_TABLES=true \
  -e COINZY_PREFER_RAW=false \
  -e DASHBOARD_AUTH_ENABLED=true \
  -e DASHBOARD_USERNAME=admin \
  -e DASHBOARD_PASSWORD='your-password' \
  -e AUTH_SECRET='long-random-string' \
  -e GOOGLE_CREDENTIALS_JSON="$(cat secrets/bigquery-metabase-sa.json)" \
  -e COINZY_GOOGLE_CREDENTIALS_JSON="$(cat secrets/coinzy-analytics-dashboard-sa.json)" \
  banknote-analytics
```

JSON may also be **base64**:

```bash
-e GOOGLE_CREDENTIALS_JSON="$(base64 < secrets/bigquery-metabase-sa.json)"
```

---

## 2. Render (recommended)

Render runs the Docker image as a web service. BigQuery queries can take >10s; Render does not cut them off like Vercel/Netlify functions.

### A. Blueprint (fastest)

1. Push this repo to GitHub (including `Dockerfile`, `render.yaml`, `sql/`, `banknote-analytics-dashboard/`).
2. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
3. Select the repo. Render reads `render.yaml`.
4. When prompted, set **secret** env vars (do not skip):

| Secret | Value |
|--------|--------|
| `DASHBOARD_USERNAME` | login user |
| `DASHBOARD_PASSWORD` | strong password |
| `AUTH_SECRET` | random 32+ chars (`openssl rand -base64 32`) |
| `GOOGLE_CREDENTIALS_JSON` | full Banknote SA JSON (paste the file) |
| `COINZY_GOOGLE_CREDENTIALS_JSON` | full Coinzy SA JSON |

5. Deploy. Open the `onrender.com` URL. Login. Switch **Banknote / Coinzy**.

### B. Manual web service

1. **New** → **Web Service** → connect the repo.
2. Runtime: **Docker**.
3. Dockerfile path: `Dockerfile`. Context: repo root.
4. Health check path: `/api/live`.
5. Add the env vars from `.env.example` plus the five secrets above.
6. Instance: at least **Starter**. Set region close to your BigQuery (`US`).

`PORT` is set by Render; the app already reads `process.env.PORT`.

---

## 3. Vercel

**Do not deploy this repo as a Vercel project and expect analytics to work.** Vercel is for static sites / short serverless functions. This app needs a long-lived Node server, SQL files on disk, and BigQuery jobs that often exceed Vercel timeouts (10s hobby / 60s pro).

### If you still want Vercel for the UI only

1. Deploy the **API** on Render with Docker (section 2).
2. In `banknote-analytics-dashboard/src/lib/api.ts` the client uses relative `/api`. You would need a rewrite:

`banknote-analytics-dashboard/vercel.json` (only if you split hosts):

```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://YOUR-RENDER-SERVICE.onrender.com/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

3. Vercel project **Root Directory**: `banknote-analytics-dashboard`.
4. Build: `npm run build`. Output: `dist`.
5. Framework: Vite.

Cookies (`SameSite=Lax`) will **not** work across two different sites. Keep UI and API on **one** Render URL unless you change auth to a token header.

**Practical recommendation:** skip Vercel; use Render Docker.

---

## 4. Netlify

Same limits as Vercel (functions timeout, no long Node server, no `sql/` tree).

### UI-only (not recommended)

1. API on Render.
2. Netlify site: base `banknote-analytics-dashboard`, build `npm run build`, publish `dist`.
3. `netlify.toml`:

```toml
[build]
  base = "banknote-analytics-dashboard"
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/api/*"
  to = "https://YOUR-RENDER-SERVICE.onrender.com/api/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Auth cookies still break across hosts. Prefer Render for the whole app.

---

## Environment variables (production)

| Variable | Required | Notes |
|----------|----------|--------|
| `PRODUCTS` | yes | `banknote,coinzy` |
| `GCP_PROJECT` / `BQ_DATASET` | yes | Banknote |
| `COINZY_GCP_PROJECT` / `COINZY_BQ_DATASET` | yes | Coinzy |
| `GOOGLE_CREDENTIALS_JSON` | yes* | Banknote SA JSON or base64 |
| `COINZY_GOOGLE_CREDENTIALS_JSON` | yes* | Coinzy SA JSON or base64 |
| `DASHBOARD_AUTH_ENABLED` | yes | `true` |
| `DASHBOARD_USERNAME` | yes | |
| `DASHBOARD_PASSWORD` | yes | |
| `AUTH_SECRET` | yes | signing key for session cookie |
| `SQL_ROOT` | Docker sets `/sql` | |
| `HOST` | Docker sets `0.0.0.0` | |
| `PORT` | Render sets this | default `3001` |
| `USE_SUMMARY_TABLES` | no | Banknote summary |
| `COINZY_USE_SUMMARY_TABLES` | no | Coinzy summary |
| `COINZY_PREFER_RAW` | no | `false` unless you want raw-only |

\*Or mount JSON files and set `GOOGLE_APPLICATION_CREDENTIALS` / `COINZY_GOOGLE_APPLICATION_CREDENTIALS`.

---

## After deploy

1. `GET /api/live` → `{ "ok": true }`
2. `GET /api/health` → both products `connected` (needs valid SA JSON)
3. Log in → sidebar **Banknote | Coinzy | Compare**
4. Coinzy MVP / funnels use `sql/dashboard/product/coinzy/` (raw events)

SA needs **BigQuery Job User** + **Data Viewer** on `events_*`. Summary refresh is a separate job (`npm run refresh-summaries:product`), not part of the web container.
