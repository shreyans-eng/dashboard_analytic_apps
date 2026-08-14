# Metabase Dashboard Specification — Coinzy Product Analytics

**Generated:** 2026-08-06  
**Data source:** BigQuery `{PROJECT}.{DATASET}`  
**App code unchanged** — documentation only.

---

## Dashboard overview

| Property | Value |
|----------|-------|
| Name | Coinzy — Product Analytics |
| Collection | Product / Analytics |
| Refresh | Daily (after Firebase export lands ~08:00 UTC) |
| Primary views | `v_daily_active_users`, `v_monthly_active_users`, `v_new_users`, `v_retention_cohorts`, `v_country_metrics`, `v_events_normalized` |

---

## 1. Data source setup

### BigQuery connection

1. Metabase Admin → Databases → Add BigQuery
2. Service account with roles:
   - `BigQuery Data Viewer` on `{PROJECT}.{DATASET}`
   - `BigQuery Job User` on `{PROJECT}`
3. Sync schema after deploying views (`sql/01` through `sql/07`)

### Recommended Metabase variables

Create **Dashboard filters** (Field Filters or Text/Date variables):

| Filter | Variable name | Type | Maps to column(s) |
|--------|---------------|------|-------------------|
| Date Range | `start_date`, `end_date` | Date | `event_date`, `cohort_date` |
| Country | `country` | Dropdown (searchable) | `country`, `first_country` |
| Platform | `platform` | Dropdown | `platform`, `first_platform` |
| App Version | `app_version` | Dropdown | `app_version`, `first_app_version` |

**Default date range:** Last 30 days  
**Default platform:** All  
**Default country:** All  

---

## 2. Dashboard layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  FILTERS: [Date Range] [Country ▼] [Platform ▼] [App Version ▼]        │
├──────────┬──────────┬──────────┬──────────┬──────────┬─────────────────┤
│   DAU    │   MAU    │New Users │    D1    │    D7    │                 │
│  (card)  │  (card)  │  (card)  │  (card)  │  (card)  │                 │
├──────────┴──────────┴──────────┴──────────┴──────────┴─────────────────┤
│                    Daily Active Users (line chart)                       │
├────────────────────────────────┬────────────────────────────────────────┤
│   Retention Trend (line)       │   Country Distribution (bar/pie)       │
├────────────────────────────────┴────────────────────────────────────────┤
│                    Event Distribution (bar chart)                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Cards (KPI numbers)

### Card 1 — DAU

| Property | Value |
|----------|-------|
| Type | Number |
| Title | DAU |
| Subtitle | Latest day in range |
| SQL | See `sql/queries/dau.sql` (single-value variant) |
| Source table | `v_daily_active_users` |
| Aggregation | `COUNT(DISTINCT resolved_user_id)` for max `event_date` in filter range |
| Comparison | Previous day (optional Metabase trend arrow) |
| Filters wired | Date Range, Country, Platform, App Version |

```sql
SELECT COUNT(DISTINCT resolved_user_id) AS dau
FROM `{PROJECT}.{DATASET}.v_daily_active_users`
WHERE event_date = (
  SELECT MAX(event_date)
  FROM `{PROJECT}.{DATASET}.v_daily_active_users`
  WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
)
[[AND country = {{country}}]]
[[AND platform = {{platform}}]]
[[AND app_version = {{app_version}}]]
```

---

### Card 2 — MAU

| Property | Value |
|----------|-------|
| Type | Number |
| Title | MAU |
| Subtitle | Current month in range |
| SQL | See `sql/queries/mau.sql` (single-value variant) |
| Source table | `v_daily_active_users` or `v_monthly_active_users` |
| Aggregation | Distinct users in calendar month containing `end_date` |
| Filters wired | Date Range, Country, Platform, App Version |

```sql
SELECT COUNT(DISTINCT resolved_user_id) AS mau
FROM `{PROJECT}.{DATASET}.v_daily_active_users`
WHERE event_date BETWEEN DATE_TRUNC({{end_date}}, MONTH) AND {{end_date}}
[[AND country = {{country}}]]
[[AND platform = {{platform}}]]
[[AND app_version = {{app_version}}]]
```

---

### Card 3 — New Users

| Property | Value |
|----------|-------|
| Type | Number |
| Title | New Users |
| Subtitle | Total in date range |
| SQL | See `sql/queries/new_users.sql` |
| Source table | `v_new_users` |
| Aggregation | `COUNT(DISTINCT resolved_user_id)` where `cohort_date` in range |
| Filters wired | Date Range, Country (`first_country`), Platform, App Version |

```sql
SELECT COUNT(DISTINCT resolved_user_id) AS new_users
FROM `{PROJECT}.{DATASET}.v_new_users`
WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
[[AND first_country = {{country}}]]
[[AND first_platform = {{platform}}]]
[[AND first_app_version = {{app_version}}]]
```

---

### Card 4 — D1 Retention

| Property | Value |
|----------|-------|
| Type | Number (percentage) |
| Title | D1 Retention |
| Subtitle | Weighted avg, mature cohorts only |
| SQL | See `sql/queries/d1_retention.sql` |
| Source table | `v_retention_cohorts` |
| Format | Percent, 1 decimal |
| Maturity rule | `cohort_date + 1 day <= today` |
| Filters wired | Date Range, Country, Platform, App Version |

```sql
SELECT SAFE_DIVIDE(SUM(retained_d1), SUM(cohort_size)) AS d1_retention_rate
FROM `{PROJECT}.{DATASET}.v_retention_cohorts`
WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
  AND DATE_ADD(cohort_date, INTERVAL 1 DAY) <= CURRENT_DATE()
[[AND country = {{country}}]]
[[AND platform = {{platform}}]]
[[AND app_version = {{app_version}}]]
```

---

### Card 5 — D7 Retention

| Property | Value |
|----------|-------|
| Type | Number (percentage) |
| Title | D7 Retention |
| Subtitle | Weighted avg, mature cohorts only |
| SQL | See `sql/queries/d7_retention.sql` |
| Source table | `v_retention_cohorts` |
| Format | Percent, 1 decimal |
| Maturity rule | `cohort_date + 7 days <= today` |
| Filters wired | Date Range, Country, Platform, App Version |

```sql
SELECT SAFE_DIVIDE(SUM(retained_d7), SUM(cohort_size)) AS d7_retention_rate
FROM `{PROJECT}.{DATASET}.v_retention_cohorts`
WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
  AND DATE_ADD(cohort_date, INTERVAL 7 DAY) <= CURRENT_DATE()
[[AND country = {{country}}]]
[[AND platform = {{platform}}]]
[[AND app_version = {{app_version}}]]
```

---

## 4. Charts

### Chart 1 — Daily Active Users (line)

| Property | Value |
|----------|-------|
| Type | Line chart |
| Title | Daily Active Users |
| X-axis | `event_date` (day) |
| Y-axis | `dau` |
| SQL | `sql/queries/dau.sql` |
| Series | Optional: split by `platform` |
| Filters wired | All four |

```sql
SELECT
  event_date,
  platform,
  COUNT(DISTINCT resolved_user_id) AS dau
FROM `{PROJECT}.{DATASET}.v_daily_active_users`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
[[AND country = {{country}}]]
[[AND platform = {{platform}}]]
[[AND app_version = {{app_version}}]]
GROUP BY event_date, platform
ORDER BY event_date;
```

**Optional second series:** overlay New Users from `v_new_users` on same chart (dual axis).

---

### Chart 2 — Retention Trend (line)

| Property | Value |
|----------|-------|
| Type | Line chart (multi-series) |
| Title | Retention Trend |
| X-axis | `cohort_date` |
| Y-axis | Retention rate (0–100%) |
| Series | D1, D7 (optional D14, D30) |
| SQL | Combined from `v_retention_cohorts` |
| Filters wired | All four |
| Note | Exclude immature cohorts per series |

```sql
SELECT
  cohort_date,
  SAFE_DIVIDE(SUM(retained_d1), SUM(cohort_size)) AS d1_rate,
  SAFE_DIVIDE(SUM(retained_d7), SUM(cohort_size)) AS d7_rate,
  SUM(cohort_size) AS cohort_size
FROM `{PROJECT}.{DATASET}.v_retention_cohorts`
WHERE cohort_date BETWEEN {{start_date}} AND {{end_date}}
  AND DATE_ADD(cohort_date, INTERVAL 7 DAY) <= CURRENT_DATE()
[[AND country = {{country}}]]
[[AND platform = {{platform}}]]
[[AND app_version = {{app_version}}]]
GROUP BY cohort_date
ORDER BY cohort_date;
```

**Visualization tip:** Add cohort_size as tooltip or secondary table below chart.

---

### Chart 3 — Country Distribution (bar or pie)

| Property | Value |
|----------|-------|
| Type | Row bar chart (preferred) or pie |
| Title | Country Distribution |
| Dimension | `country` |
| Metric | `unique_users` or `dau` sum |
| SQL | `sql/queries/top_countries.sql` |
| Limit | Top 15 + "Other" bucket optional |
| Filters wired | Date Range, Platform, App Version (Country filter hidden or set to All) |

```sql
SELECT
  country,
  COUNT(DISTINCT resolved_user_id) AS unique_users
FROM `{PROJECT}.{DATASET}.v_daily_active_users`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
[[AND platform = {{platform}}]]
[[AND app_version = {{app_version}}]]
GROUP BY country
ORDER BY unique_users DESC
LIMIT 15;
```

---

### Chart 4 — Event Distribution (bar)

| Property | Value |
|----------|-------|
| Type | Row bar chart |
| Title | Event Distribution |
| Dimension | `event_name_base` |
| Metric | `event_count` |
| SQL | `sql/queries/top_events.sql` |
| Limit | Top 25 events |
| Filters wired | All four |
| Optional toggle | Exclude automatic/noise events (`session_start`, `user_engagement`) |

```sql
SELECT
  event_name_base,
  COUNT(*) AS event_count,
  COUNT(DISTINCT resolved_user_id) AS unique_users
FROM `{PROJECT}.{DATASET}.v_events_normalized`
WHERE event_date BETWEEN {{start_date}} AND {{end_date}}
  AND event_name_base NOT IN ('user_engagement', 'session_start')
[[AND country = {{country}}]]
[[AND platform = {{platform}}]]
[[AND app_version = {{app_version}}]]
GROUP BY event_name_base
ORDER BY event_count DESC
LIMIT 25;
```

---

## 5. Filter wiring (Metabase setup steps)

### Step-by-step

1. Create dashboard **Coinzy — Product Analytics**
2. Add questions (cards + charts) from SQL above
3. Add dashboard filters:
   - **Date** → map to `start_date` / `end_date` on every question
   - **Country** → map to `country` or `first_country` column
   - **Platform** → map to `platform` or `first_platform`
   - **App Version** → map to `app_version` or `first_app_version`
4. Set filter default: Last 30 days
5. Enable **cross-filtering** on Country Distribution chart (click country → filters rest)

### Dropdown population queries

**Country list:**
```sql
SELECT DISTINCT country
FROM `{PROJECT}.{DATASET}.v_events_normalized`
WHERE country IS NOT NULL AND country != 'Unknown'
ORDER BY country;
```

**Platform list:**
```sql
SELECT DISTINCT platform FROM `{PROJECT}.{DATASET}.v_events_normalized`
WHERE platform IS NOT NULL ORDER BY platform;
```

**App version list:**
```sql
SELECT DISTINCT app_version FROM `{PROJECT}.{DATASET}.v_events_normalized`
WHERE app_version IS NOT NULL ORDER BY app_version DESC;
```

---

## 6. Optional extended cards (Phase 2)

| Card | Source | SQL hint |
|------|--------|----------|
| WAU | `v_daily_active_users` | `sql/queries/wau.sql` |
| Stickiness (DAU/MAU) | computed | DAU / MAU same month |
| Identification success rate | `v_country_metrics` | `identification_success_rate` avg |
| Subs conversion | `v_subscription_metrics` | `paywall_to_confirm_rate` |
| Paying users | `v_subscription_metrics` | `SUM(paying_users)` |

---

## 7. Data quality checks (run weekly)

| Check | Query |
|-------|-------|
| Null user IDs | `SELECT COUNT(*) FROM v_events_normalized WHERE resolved_user_id IS NULL` |
| Unknown countries | `SELECT COUNT(*) FROM v_events_normalized WHERE country = 'Unknown'` |
| Event name drift | Compare top 50 events week-over-week |
| Cohort maturity | Ensure D7 card excludes last 7 days of cohorts |
| DAU vs Firebase console | Spot-check single day ±5% |

---

## 8. Performance notes

- Always filter on `event_date` / `cohort_date` — BigQuery partition key
- Avoid `SELECT *` on `v_events_normalized` in Metabase
- For slow dashboards, materialize:
  - `v_daily_active_users` → nightly scheduled table
  - `v_retention_cohorts` → nightly scheduled table
- Set Metabase cache: 6–24 hours for daily export cadence

---

## 9. File reference

| Artifact | Path |
|----------|------|
| View DDL | `sql/01_v_events_normalized.sql` … `sql/07_v_subscription_metrics.sql` |
| Metric queries | `sql/queries/*.sql` |
| BigQuery setup guide | `analytics-bigquery-plan.md` |
| This dashboard spec | `analytics-dashboard-plan.md` |
