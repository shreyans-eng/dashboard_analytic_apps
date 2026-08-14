# Deploy the analytics dashboard (live URL)

**Goal:** a public URL like `https://banknote-analytics.onrender.com` that the team can log into.

**Host:** [Render](https://render.com) with Docker.  
This app is a Node server + BigQuery. Do **not** deploy it as a Vercel or Netlify site.

The code is already on GitHub:

https://github.com/shreyans-eng/dashboard_analytic_apps

---

## Before you start (5 minutes)

You need:

1. A [Render](https://dashboard.render.com) account (sign up with GitHub).
2. Access to the GitHub repo above.
3. Two service-account JSON files on your laptop (do **not** put these on GitHub):
   - `secrets/bigquery-metabase-sa.json` (Banknote)
   - `secrets/coinzy-analytics-dashboard-sa.json` (Coinzy)
4. Login values from `banknote-analytics-dashboard/.env`:
   - `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` (seeds the first admin)
   - `AUTH_SECRET`
   - `MONGODB_URI` (Atlas connection string)
   - `MONGODB_DB` = `analytics_dashboard`

Open each JSON file in a text editor and keep them ready to paste (the whole file, including `{` and `}`).

---

## Deploy on Render (click-by-click)

### Step 1 — Create a Web Service

1. Go to [https://dashboard.render.com](https://dashboard.render.com).
2. Click **New +** (top right) → **Web Service**.
3. Click **Build and deploy from a Git repository**.
4. Connect GitHub if asked, then select **`shreyans-eng/dashboard_analytic_apps`**.
5. Click **Connect**.

### Step 2 — Fill in the service settings

Use these exact values:

| Field | Value |
|-------|--------|
| **Name** | `banknote-analytics` (or any name you like) |
| **Language / Runtime** | **Docker** |
| **Branch** | `main` |
| **Root Directory** | leave **empty** (repo root) |
| **Dockerfile Path** | `Dockerfile` |
| **Docker Build Context Directory** | `.` or leave empty |
| **Instance type** | **Starter** (or Free if you accept sleep after idle) |
| **Region** | **Oregon (US West)** — closest to BigQuery `US` |

Do **not** set a custom build/start command. Docker uses the Dockerfile.

### Step 3 — Add environment variables

On the same page, open **Environment** → **Add Environment Variable**. Add **all** of these.

#### Already known (copy as-is)

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `SQL_ROOT` | `/sql` |
| `PRODUCTS` | `banknote,coinzy` |
| `GCP_PROJECT` | `banknote-app-4f3fd` |
| `BQ_DATASET` | `analytics_488476338` |
| `BQ_SUMMARY_DATASET` | `analytics_summary` |
| `USE_SUMMARY_TABLES` | `true` |
| `COINZY_GCP_PROJECT` | `coinzy-26a4d` |
| `COINZY_BQ_DATASET` | `analytics_487601380` |
| `COINZY_BQ_SUMMARY_DATASET` | `analytics_summary` |
| `COINZY_USE_SUMMARY_TABLES` | `true` |
| `COINZY_PREFER_RAW` | `false` |
| `DASHBOARD_AUTH_ENABLED` | `true` |
| `MONGODB_DB` | `analytics_dashboard` |

Do **not** set `PORT`. Render sets it automatically.

#### Secrets (paste from your laptop)

| Key | Where to copy from |
|-----|---------------------|
| `DASHBOARD_USERNAME` | `.env` → `DASHBOARD_USERNAME` (seeds admin if missing) |
| `DASHBOARD_PASSWORD` | `.env` → `DASHBOARD_PASSWORD` |
| `AUTH_SECRET` | `.env` → `AUTH_SECRET` |
| `MONGODB_URI` | Atlas URI, including password |
| `GOOGLE_CREDENTIALS_JSON` | entire `secrets/bigquery-metabase-sa.json` |
| `COINZY_GOOGLE_CREDENTIALS_JSON` | entire `secrets/coinzy-analytics-dashboard-sa.json` |

How to paste JSON:

1. Open the `.json` file.
2. Select all → copy.
3. Paste into the Render value box. It must start with `{` and end with `}`.
4. Do not wrap it in quotes.

Mark those five as **Secret** if Render shows that option.

### Step 4 — Health check

If you see **Health Check Path**, set:

```text
/api/live
```

### Step 5 — Deploy

1. Click **Deploy Web Service** (or **Create Web Service**).
2. Watch **Logs**. First build takes **5–10 minutes** (Docker + `npm ci` + Vite).
3. Success looks like:

```text
Product Analytics API → http://0.0.0.0:XXXX
  SQL_ROOT=/sql
  Auth: enabled (login required)
  Banknote: banknote-app-4f3fd.analytics_488476338 (creds: true, ...)
  Coinzy: coinzy-26a4d.analytics_487601380 (creds: true, ...)
```

`creds: true` for both apps is required. If either is `false`, the JSON env var was not pasted correctly — fix it and **Manual Deploy**.

### Step 6 — Open the live URL

On the service page, copy the URL, for example:

```text
https://banknote-analytics.onrender.com
```

1. Open it in a browser.
2. Log in with `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` (admin).
3. Open **Users & access** in the sidebar to create sub-admins and choose which apps/pages they can see.
4. Switch **Banknote / Coinzy / Compare** (sub-admins only see what you assigned).

Share **that URL** with the team (plus the login).

---

## Confirm it works

In a browser or terminal:

| Check | Expected |
|-------|----------|
| `https://YOUR-APP.onrender.com/api/live` | `{"ok":true}` |
| `https://YOUR-APP.onrender.com/api/health` | `"status":"ok"` and both products `"connected"` |
| Home page | login screen, then dashboard |

If `/api/health` shows `"status":"error"` on Coinzy or Banknote, the matching `*_CREDENTIALS_JSON` is wrong or the SA lacks BigQuery access.

Each SA needs:

- **BigQuery Job User** on the GCP project
- **BigQuery Data Viewer** on the analytics dataset (`events_*`)

---

## Optional: Blueprint instead of manual

If you prefer Render to read `render.yaml`:

1. **New +** → **Blueprint**.
2. Select `shreyans-eng/dashboard_analytic_apps`.
3. Apply. Fill the **secret** fields Render prompts for (username, password, `AUTH_SECRET`, both JSON blobs).
4. Same live URL as above.

---

## Sharing with the team

Send:

1. Live URL (`https://….onrender.com`)
2. Username
3. Password

Remind them:

- First load on the **Free** plan can take ~30–60 seconds (service sleeps when idle).
- Use **Starter** if you want it always on.

---

## Local Docker (optional, not needed for the team URL)

From the folder that contains `Dockerfile`, `sql/`, and `banknote-analytics-dashboard/`:

```bash
docker build -t banknote-analytics .
docker compose up --build
```

Open http://localhost:3001

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails `COPY sql` / `COPY banknote-analytics-dashboard` | Root Directory must be **empty**. Repo root must contain `Dockerfile` and `sql/`. |
| Deploy succeeds but `creds: false` | Re-paste `GOOGLE_CREDENTIALS_JSON` / `COINZY_GOOGLE_CREDENTIALS_JSON` as raw JSON. Redeploy. |
| Login loop / cookie errors | Keep `DASHBOARD_AUTH_ENABLED=true`. Use `https://` URL (not http). |
| Login fails / Mongo timeout | In Atlas → Network Access, allow the Render IP (or `0.0.0.0/0` for testing). Set `MONGODB_URI`. |
| Charts empty / BigQuery error | SA needs Job User + Data Viewer. Check `/api/health`. |
| Site sleeps, slow first open | Free plan. Upgrade to Starter. |
| `port already in use` locally | Your laptop `npm run dev` is on 3001. Stop it, or use `docker run -p 3011:3001`. |

Do **not** commit `.env` or `secrets/*.json`.

---

## Why not Vercel or Netlify?

They run short serverless functions. This dashboard runs long BigQuery jobs and needs the `sql/` folder on disk. Put the **whole app on Render**. A split (UI on Vercel, API on Render) breaks login cookies.
