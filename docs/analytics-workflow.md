# Coinzy Analytics — End-to-End Workflow

**Version:** 1.0  
**Last updated:** 2026-08-06  
**Stack:** Firebase Analytics → BigQuery → Metabase  
**Project:** `banknote-app-4f3fd` · Dataset: `analytics_488476338`

---

## Architecture

```
┌─────────────────┐     daily export      ┌──────────────────────────────┐
│  Coinzy App     │ ───────────────────►  │  BigQuery                    │
│  (React Native) │   events_YYYYMMDD     │  analytics_488476338         │
│  Firebase SDK   │                       │  ├── events_* (raw)          │
└─────────────────┘                       │  ├── v_events_normalized     │
                                          │  ├── v_daily_active_users    │
                                          │  ├── v_monthly_active_users  │
                                          │  ├── v_new_users             │
                                          │  ├── v_country_metrics       │
                                          │  └── v_retention_cohorts     │
                                          └──────────────┬───────────────┘
                                                         │ SQL
                                                         ▼
                                          ┌──────────────────────────────┐
                                          │  Metabase                    │
                                          │  ├── Collections (sidebar)   │
                                          │  ├── Questions (SQL cards)   │
                                          │  └── Dashboards              │
                                          └──────────────────────────────┘
```

---

## Phase status tracker

| Phase | Name | Status | Deliverable |
|-------|------|--------|-------------|
| 1 | Analytics Audit | ✅ Complete | Event inventory (144 events) |
| 2 | BigQuery Setup | ✅ Complete | Firebase export verified |
| 3 | Local Environment | ✅ Complete | Docker + Metabase on :3000 |
| 4 | BigQuery → Metabase | ✅ Complete | Banknote Analytics connected |
| 5 | Data Modeling | ✅ Complete | 6/7 views deployed |
| 6 | Validation | ⬜ Pending | `sql/validation/` |
| 7 | Build Questions | ⬜ Pending | Bootstrap script ready |
| 8 | Build Dashboard | ⬜ Pending | Bootstrap script ready |
| 9 | Dashboard Filters | ⬜ Pending | Manual UI step |
| 10 | QA | ⬜ Pending | Checklist below |
| 11 | Documentation | 🔄 In progress | This doc + user guide |
| 12 | Production Go-Live | ⬜ Pending | VM + HTTPS + SSO |

---

## Phase 1 — Analytics Audit ✅

**Goal:** Understand existing Firebase Analytics implementation.

**What was done:**
- Scanned React Native codebase for all `track*` functions and `logEvent` calls
- Found 144 Firebase events via central wrapper (`src/util/analytics.ts`)
- Identified 10 unused event definitions
- Identified missing areas (Evaluate flow, credits, gallery permissions)
- Documented platform suffix pattern (`{event}_android` / `{event}_ios`)

**Key files in repo:**
- Event wrapper: `src/util/analytics.ts`
- Attribution: `src/services/analytics/attributionAnalytics.ts`

**Status:** Complete (audit performed in prior session; see conversation history)

---

## Phase 2 — BigQuery Setup ✅

**Goal:** Firebase Analytics exporting to BigQuery.

**Verified:**
| Item | Value |
|------|-------|
| GCP Project | `banknote-app-4f3fd` |
| Dataset | `analytics_488476338` |
| Daily tables | `events_YYYYMMDD` |
| Performance tables | `firebase_performance` |
| Service account | `metabase-local-dev@banknote-app-4f3fd.iam.gserviceaccount.com` |
| IAM roles | BigQuery Data Viewer, BigQuery Job User |

---

## Phase 3 — Local Analytics Environment ✅

**Goal:** Run Metabase locally on Mac.

**What was done:**
```bash
# Install Docker Desktop (manual — requires admin password)
brew install --cask docker
open -a Docker

# Start Metabase
cd bigdata/
docker compose up -d
# → http://localhost:3000
```

**Files:**
- `docker-compose.yml`
- `scripts/metabase-start.sh`, `metabase-stop.sh`, `metabase-logs.sh`
- `docs/metabase-local-setup.md`

---

## Phase 4 — Connect BigQuery to Metabase ✅

**Goal:** Metabase reads Firebase export tables.

**Steps performed:**
1. Created service account `metabase-local-dev`
2. Granted BigQuery Data Viewer + Job User (required admin approval)
3. Uploaded JSON key in Metabase Admin → Databases → BigQuery
4. Set Project ID: `banknote-app-4f3fd`
5. Set dataset filter: `analytics_488476338`
6. Synced schema → `events_*` tables visible in Browse

**Troubleshooting doc:** `docs/fix-metabase-no-datasets.md`

---

## Phase 5 — Analytics Data Modeling ✅

**Goal:** Deploy semantic layer views in BigQuery.

**Deploy command:**
```bash
PROJECT=banknote-app-4f3fd DATASET=analytics_488476338 ./deploy-views.sh
```

**Views deployed:**

| View | Purpose | Status |
|------|---------|--------|
| `v_events_normalized` | Clean event stream, strip `_android`/`_ios` | ✅ |
| `v_daily_active_users` | User × day grain for DAU | ✅ |
| `v_monthly_active_users` | User × month grain for MAU | ✅ |
| `v_new_users` | Cohort anchor (install/registration) | ✅ |
| `v_country_metrics` | Daily geo KPIs | ✅ |
| `v_retention_cohorts` | D1/D7/D14/D30 retention | ✅ |
| `v_subscription_metrics` | Monetization funnel | ⏸ Fix pending |

**Schema reference:** `docs/view-schema.md`

---

## Phase 6 — Validation ⬜

**Goal:** Confirm views are healthy before building dashboards.

**Run in Metabase → New → SQL query:**

| File | Pass criteria |
|------|---------------|
| `sql/validation/01_views_return_data.sql` | All views `row_count > 0` |
| `sql/validation/02_no_null_dates.sql` | All `null_count = 0` |
| `sql/validation/03_country_field_exists.sql` | `distinct_countries > 1` |
| `sql/validation/04_no_duplicate_users.sql` | `duplicate_user_days = 0` |
| `sql/validation/05_retention_bounds.sql` | 0 rows returned |

---

## Phase 7 — Build Analytics Questions ⬜

**Goal:** Reusable dashboard questions and visualizations.

### Option A — Custom Banknote AI Dashboard (recommended)

Vite + React web app with sidebar navigation and SQL Editor:

```bash
cd banknote-analytics-dashboard
npm install
cp .env.example .env   # set GOOGLE_APPLICATION_CREDENTIALS
npm run dev
# → http://localhost:5173
```

See: `banknote-analytics-dashboard/README.md`

### Option B — Metabase bootstrap

```bash
export METABASE_EMAIL=your@email.com
export METABASE_PASSWORD=yourpassword
./scripts/bootstrap-dashboard.sh
```

**Questions created:**

| # | Question | SQL file | Collection |
|---|----------|----------|------------|
| 1 | Daily Active Users | `01_daily_active_users.sql` | Executive |
| 2 | Monthly Active Users | `02_monthly_active_users.sql` | Executive |
| 3 | New Users | `03_new_users.sql` | Executive |
| 4 | D1 Retention | `05_d1_retention.sql` | Retention |
| 5 | D7 Retention | `06_d7_retention.sql` | Retention |
| 6 | Top Countries | `04_top_countries.sql` | Acquisition |
| 7 | Top Events | `07_top_events.sql` | Feature Usage |
| 8 | Platform Breakdown | `08_platform_breakdown.sql` | Acquisition |

---

## Phase 8 — Build Dashboard ⬜

**Goal:** Coinzy Executive Dashboard with sidebar navigation.

**Navigation structure (Metabase Collections = sidebar tabs):**

```
Coinzy Analytics                    ← click in left sidebar
├── Executive
│   └── Coinzy Executive Dashboard  ← main KPI dashboard
├── Retention
│   └── Retention Dashboard
├── Acquisition
│   └── Acquisition Dashboard
├── Feature Usage
│   └── Feature Usage Dashboard
└── Debug
    └── (validation queries)
```

**Executive Dashboard layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  [Date Range]  [Country ▼]  [Platform ▼]                      │
├──────────────────────┬──────────────┬───────────────────────┤
│  Daily Active Users  │  MAU         │  New Users            │
│  (line)              │  (bar/num)   │  (line/num)           │
├──────────────────────┴──────────────┴───────────────────────┤
│  D1 Retention        │  D7 Retention                       │
├──────────────────────┴─────────────────────────────────────┤
│  Top Countries       │  Platform Breakdown                  │
├──────────────────────┴─────────────────────────────────────┤
│  Top Events (full width)                                    │
└─────────────────────────────────────────────────────────────┘
```

**Spec:** `docs/coinzy-executive-dashboard.md`

---

## Phase 9 — Dashboard Filters ⬜

**Required filters:**

| Filter | Variable | Default |
|--------|----------|---------|
| Date Range | `start_date`, `end_date` | Last 30 days |
| Country | `country` / `first_country` | All |
| Platform | `platform` / `first_platform` | All |

Wire each filter to every card on the dashboard (Metabase edit mode → filter icon on each card).

---

## Phase 10 — QA ⬜

**Checklist:**

- [ ] All charts load without SQL errors
- [ ] Dashboard loads in < 30 seconds
- [ ] Date filter updates all cards
- [ ] Country filter narrows all cards
- [ ] Platform filter narrows all cards
- [ ] DAU matches manual BigQuery query
- [ ] D1/D7 retention between 0–100%
- [ ] Top events show Coinzy events (not just GA4 auto events)

---

## Phase 11 — Documentation 🔄

| Document | Status |
|----------|--------|
| `docs/analytics-workflow.md` | ✅ This file |
| `docs/view-schema.md` | ✅ |
| `docs/coinzy-executive-dashboard.md` | ✅ |
| `docs/metabase-dashboard-setup.md` | ✅ |
| `docs/dashboard-user-guide.md` | ✅ |
| `docs/metabase-local-setup.md` | ✅ |
| `docs/analytics-dashboard-progress.md` | ✅ |

---

## Phase 12 — Production Go-Live ⬜

**Goal:** Deploy Metabase for team access at e.g. `https://analytics.coinzy.com`

**Tasks:**

1. **Deploy Metabase** on VM / Cloud Run / Kubernetes
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```
2. **HTTPS** — reverse proxy (nginx / Caddy / Cloud Load Balancer)
3. **Authentication** — Google SSO or email/password
4. **User roles:**
   | Role | Access |
   |------|--------|
   | Admin | Full config |
   | Product | All dashboards, no admin |
   | Engineering | Feature Usage + Debug |
   | Read Only | Executive dashboard only |
5. **Connect production BigQuery** (same project/dataset or read replica)
6. **Schedule schema sync** — Metabase Admin → Database → hourly sync
7. **Cache TTL** — 6 hours (matches daily Firebase export)
8. **Share URL** with stakeholders
9. **Smoke test** production checklist (same as Phase 10)

---

## How to initialize from scratch

Complete setup sequence for a new developer:

```bash
# 1. Clone / open bigdata repo
cd /path/to/bigdata

# 2. Start Metabase
docker compose up -d
# → http://localhost:3000 (create admin account)

# 3. Connect BigQuery (Metabase UI)
#    Admin → Databases → Add BigQuery
#    Upload service account JSON
#    Project: banknote-app-4f3fd, Dataset: analytics_488476338

# 4. Deploy BigQuery views
PROJECT=banknote-app-4f3fd DATASET=analytics_488476338 ./deploy-views.sh

# 5. Sync Metabase schema
#    Admin → Databases → Sync database schema now

# 6. Run validation
#    Paste sql/validation/*.sql in Metabase SQL editor

# 7. Bootstrap dashboards (automated)
pip install requests
export METABASE_EMAIL=you@example.com
export METABASE_PASSWORD=yourpassword
python3 scripts/metabase-bootstrap.py

# 8. Add filters manually in Metabase UI (Phase 9)

# 9. QA (Phase 10 checklist)
```

---

## Definition of done

The analytics platform is **LIVE** when:

- [x] Firebase exports to BigQuery
- [x] BigQuery views deployed (6/7)
- [ ] Validation queries pass
- [ ] Dashboard created with sidebar navigation
- [ ] Filters wired and working
- [ ] Documentation complete
- [ ] Production deployment
- [ ] Team has access
- [ ] Dashboard URL shared

---

## File index

```
bigdata/
├── docs/
│   ├── analytics-workflow.md          ← This file (master workflow)
│   ├── analytics-dashboard-progress.md
│   ├── coinzy-executive-dashboard.md
│   ├── dashboard-user-guide.md
│   ├── metabase-dashboard-setup.md
│   ├── metabase-local-setup.md
│   ├── metabase-navigation-structure.md
│   └── view-schema.md
├── sql/
│   ├── 01–07_v_*.sql                  ← BigQuery view DDL
│   ├── dashboard/                     ← Metabase question SQL (8 files)
│   └── validation/                    ← QA queries (5 files)
├── scripts/
│   ├── metabase-bootstrap.py          ← Auto-create dashboards
│   ├── deploy-views.sh
│   └── metabase-*.sh
├── docker-compose.yml
└── deploy-views.sh
```
