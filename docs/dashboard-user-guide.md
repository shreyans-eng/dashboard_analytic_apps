# Coinzy Analytics Dashboard — User Guide

**Audience:** Product, Engineering, Leadership  
**Dashboard URL (local):** http://localhost:3000  
**Production URL (future):** https://analytics.coinzy.com

---

## Overview

The Coinzy Analytics Dashboard provides real-time product metrics from Firebase Analytics data exported to BigQuery and visualized in Metabase.

**Supported metrics:**
- Daily Active Users (DAU)
- Monthly Active Users (MAU)
- New Users
- D1 / D7 Retention
- Country breakdown
- Platform breakdown (Android / iOS)
- Top Events

---

## How to access

### Local (development)
1. Open http://localhost:3000
2. Log in with your Metabase account
3. Left sidebar → **COLLECTIONS** → **Coinzy Analytics**
4. Click **Executive** → **Coinzy Executive Dashboard**

### Production (when live)
- URL will be shared by the analytics team
- Log in with Google SSO or email/password

---

## Dashboard layout

### Coinzy Executive Dashboard

| Row | Cards | What it shows |
|-----|-------|---------------|
| 1 | DAU · MAU · New Users | Daily engagement and growth |
| 2 | D1 Retention · D7 Retention | User return rates |
| 3 | Top Countries · Platform Breakdown | Geographic and platform split |
| 4 | Top Events | Most fired Firebase events |

### Other dashboards

| Dashboard | Location | Focus |
|-----------|----------|-------|
| Retention Dashboard | Coinzy Analytics → Retention | D1/D7 trends over time |
| Acquisition Dashboard | Coinzy Analytics → Acquisition | New users, countries, platforms |
| Feature Usage Dashboard | Coinzy Analytics → Feature Usage | Event volume by feature |

---

## Filters

Every dashboard supports three filters:

| Filter | Options | Default |
|--------|---------|---------|
| **Date Range** | Any date range | Last 30 days |
| **Country** | All countries with data | All |
| **Platform** | `android`, `ios` | All |

**How to use:**
1. Click filter at top of dashboard
2. Select value
3. All cards update automatically

---

## KPI definitions

### Daily Active Users (DAU)

**Definition:** Distinct users with at least one event on a given day.

**Formula:**
```sql
COUNT(DISTINCT resolved_user_id) GROUP BY event_date
```

**Source:** `v_daily_active_users`

**Identity:** `user_id` (if logged in) → event param `user_id` → `user_pseudo_id` (device)

---

### Monthly Active Users (MAU)

**Definition:** Distinct users with at least one event in a calendar month.

**Formula:**
```sql
COUNT(DISTINCT resolved_user_id) GROUP BY activity_month
```

**Source:** `v_monthly_active_users`

---

### New Users

**Definition:** Users appearing for the first time, by cohort date.

**Cohort priority:**
1. `first_open` (app install)
2. `Registration` event
3. Earliest event date (fallback)

**Source:** `v_new_users`

---

### D1 Retention

**Definition:** Percentage of users who return **exactly 1 day** after their cohort date.

**Formula:**
```
D1 = users active on cohort_date + 1 day / cohort_size
```

**Source:** `v_retention_cohorts`

**Note:** Cohorts from the last 1 day are excluded (immature data).

---

### D7 Retention

**Definition:** Percentage of users who return **exactly 7 days** after their cohort date.

**Formula:**
```
D7 = users active on cohort_date + 7 days / cohort_size
```

**Source:** `v_retention_cohorts`

**Note:** Cohorts from the last 7 days are excluded (immature data).

---

### Country

**Definition:** User's country from Firebase event parameter `country`, falling back to GA4 geo data.

**Source:** `country` column in views, `first_country` in `v_new_users`

**Known limitation:** Guest users may show `Unknown` if country param is not set.

---

### Platform

**Definition:** `android` or `ios`, parsed from event name suffix (`_android` / `_ios`) or device OS.

**Source:** `platform` column in all views

---

### Top Events

**Definition:** Most frequently fired Firebase events, normalized to base name (without platform suffix).

**Example:** `App_open_android` and `App_open_ios` → `App_open`

**Source:** `v_events_normalized`

---

## Data refresh schedule

| Layer | Refresh |
|-------|---------|
| Firebase → BigQuery | Daily (~08:00 UTC) |
| BigQuery views | Real-time (views query underlying tables) |
| Metabase cache | 6–24 hours (configurable) |

**Implication:** Today's data may be incomplete until the daily export runs.

---

## Known limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Platform suffix doubles event names in raw data | Raw `events_*` tables show `_android`/`_ios` variants | Use `v_events_normalized` or dashboard queries |
| Guest users use `user_pseudo_id` | Cross-device user counts may be inflated | Encourage login; `setUserId()` in app (future) |
| Country param optional | Some users show as `Unknown` | Filter out Unknown for geo analysis |
| Retention immature cohorts | Last N days show incomplete retention | Dashboard excludes immature cohorts |
| Evaluate / Credits not tracked | No events for expert evaluation flow | Add instrumentation (future) |
| `v_subscription_metrics` pending | No monetization dashboard yet | Fix and deploy view |

---

## FAQ

**Q: Why does DAU differ from Firebase Console?**  
A: Different identity models. We use `resolved_user_id`; Firebase Console uses `user_pseudo_id` by default.

**Q: Why are there two events for every action?**  
A: Coinzy app logs `{event}_android` and `{event}_ios`. Dashboard queries use normalized names.

**Q: Can I export data?**  
A: Yes — click any chart → download icon → CSV/PNG.

**Q: How do I request a new metric?**  
A: File a request with Product Analytics specifying the event, definition, and dashboard placement.

---

## Support

| Issue | Contact |
|-------|---------|
| Dashboard not loading | Data team / check Metabase container |
| Wrong numbers | Data team — run validation queries |
| New metric request | Product Analytics |
| Access request | Admin → People |

---

## Related docs

| Doc | Purpose |
|-----|---------|
| `docs/analytics-workflow.md` | Full setup workflow |
| `docs/view-schema.md` | Column reference |
| `docs/metabase-navigation-structure.md` | Sidebar navigation |
| `docs/coinzy-executive-dashboard.md` | Dashboard specification |
