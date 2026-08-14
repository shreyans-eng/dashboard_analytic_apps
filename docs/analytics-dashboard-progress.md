# Analytics Dashboard Progress — Coinzy

**Last updated:** 2026-08-06  
**Owner:** Product Analytics  
**Environment:** Local Metabase + BigQuery

---

## Completed

| Item | Status | Notes |
|------|--------|-------|
| Docker Desktop | ✅ Done | Metabase container running on port 3000 |
| Metabase local install | ✅ Done | Container `metabase`, volume `metabase-data` |
| BigQuery connection | ✅ Done | Database: Banknote Analytics |
| Firebase → BigQuery export | ✅ Done | Dataset `analytics_488476338` |
| Service account IAM | ✅ Done | `metabase-local-dev` with Data Viewer + Job User |
| Analytics views (6/7) | ✅ Done | See view list below |
| View schema documentation | ✅ Done | `docs/view-schema.md` |
| Dashboard SQL queries | ✅ Done | `sql/dashboard/` (7 files) |
| Validation SQL | ✅ Done | `sql/validation/` (5 files) |
| Dashboard specification | ✅ Done | `docs/coinzy-executive-dashboard.md` |
| Metabase setup guide | ✅ Done | `docs/metabase-dashboard-setup.md` |

### Deployed views

| View | Status |
|------|--------|
| `v_events_normalized` | ✅ |
| `v_daily_active_users` | ✅ |
| `v_monthly_active_users` | ✅ |
| `v_new_users` | ✅ |
| `v_country_metrics` | ✅ |
| `v_retention_cohorts` | ✅ |
| `v_subscription_metrics` | ⏸ Optional — fix pending |

---

## Remaining

| Item | Status | Guide / Command |
|------|--------|-----------------|
| Run validation queries | ⬜ Todo | `sql/validation/` |
| Bootstrap dashboards (automated) | ⬜ Todo | `./scripts/bootstrap-dashboard.sh` |
| Add dashboard filters | ⬜ Todo | Manual UI — Phase 9 |
| Wire filters to all cards | ⬜ Todo | `docs/metabase-dashboard-setup.md` Part 4 |
| QA checklist | ⬜ Todo | `docs/analytics-workflow.md` Phase 10 |
| Production deployment | ⬜ Todo | `docs/analytics-workflow.md` Phase 12 |
| Subscription dashboard | ⬜ Future | After `v_subscription_metrics` fix |

### Automated bootstrap (creates sidebar + dashboards)

```bash
export METABASE_EMAIL=shreyans@tracklio.com   # your Metabase admin email
export METABASE_PASSWORD=yourpassword
./scripts/bootstrap-dashboard.sh
```

---

## File map

```
bigdata/
├── docs/
│   ├── view-schema.md                    ← Column reference
│   ├── coinzy-executive-dashboard.md     ← Dashboard spec
│   ├── metabase-dashboard-setup.md       ← Step-by-step UI guide
│   ├── metabase-local-setup.md           ← Docker + BQ connection
│   └── analytics-dashboard-progress.md   ← This file
├── sql/
│   ├── dashboard/                        ← 7 Metabase question SQL files
│   │   ├── 01_daily_active_users.sql
│   │   ├── 02_monthly_active_users.sql
│   │   ├── 03_new_users.sql
│   │   ├── 04_top_countries.sql
│   │   ├── 05_d1_retention.sql
│   │   ├── 06_d7_retention.sql
│   │   └── 07_top_events.sql
│   └── validation/                       ← Data quality checks
│       ├── 01_views_return_data.sql
│       ├── 02_no_null_dates.sql
│       ├── 03_country_field_exists.sql
│       ├── 04_no_duplicate_users.sql
│       └── 05_retention_bounds.sql
```

---

## Next milestone

**Milestone 1 — Executive Dashboard v1**

Definition of done:
- [ ] All 7 questions saved in Metabase
- [ ] Dashboard built with correct layout
- [ ] 3 filters wired and working
- [ ] Validation queries pass with 0 critical failures
- [ ] Dashboard shared with team (or screenshot exported)

**Milestone 2 — Monetization Dashboard**

- Deploy fixed `v_subscription_metrics`
- Add subs funnel cards (paywall → pack → confirm)

---

## Validation checklist

Run in Metabase **New → SQL query** before building dashboard:

| Query file | Expected result |
|------------|-----------------|
| `01_views_return_data.sql` | All 6 views: `row_count > 0` |
| `02_no_null_dates.sql` | All `null_count = 0` |
| `03_country_field_exists.sql` | `distinct_countries > 1`, `unknown_pct < 50%` |
| `04_no_duplicate_users.sql` | `duplicate_user_days = 0` |
| `05_retention_bounds.sql` | 0 rows (all rates 0–1) |
