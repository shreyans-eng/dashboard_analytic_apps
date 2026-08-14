# BigQuery View Schema Reference — Coinzy Analytics

**Project:** `banknote-app-4f3fd`  
**Dataset:** `analytics_488476338`  
**Generated:** 2026-08-06  
**Source:** Deployed view DDL in `sql/01`–`sql/06`

---

## Overview

| View | Grain | Primary use |
|------|-------|-------------|
| `v_events_normalized` | Event | Base layer; event-level analysis |
| `v_daily_active_users` | User × day | DAU, daily engagement |
| `v_monthly_active_users` | User × month | MAU, monthly engagement |
| `v_new_users` | User | New user / cohort anchor |
| `v_country_metrics` | Country × platform × day | Geo KPIs |
| `v_retention_cohorts` | Cohort × platform × country × day | D1/D7/D14/D30 retention |
| `v_subscription_metrics` | Day × platform × country | Paywall → purchase funnel |
| `v_identify_metrics` | Day × platform × country | Identify funnel, success, quota |
| `v_time_to_first_scan` | Cohort × platform × country | Time-to-first successful ID |
| `v_scan_experiment_metrics` | Cohort × variant | Optional / ad-hoc (not MVP) |
| `v_engagement_metrics` | Day × platform × country | Scans/user, collection, market, feed |
| `v_attribution_metrics` | Cohort × UTM | Install quality (scan + paid) |
| `v_onboarding_metrics` | Day × platform × country | Onboarding completion |
| `v_product_kpi_daily` | Day | Overview MVP scorecards |

---

## v_daily_active_users

One row per `resolved_user_id` per calendar day with activity.

| Column | Type | Description |
|--------|------|-------------|
| `event_date` | DATE | Activity date |
| `resolved_user_id` | STRING | User identity: `user_id` → param `user_id` → `user_pseudo_id` |
| `user_pseudo_id` | STRING | GA4 device identifier |
| `platform` | STRING | Most frequent platform that day (`android` / `ios`) |
| `country` | STRING | Most frequent country that day |
| `app_version` | STRING | Most frequent app version that day |
| `event_count` | INT64 | Total events that day for this user |
| `session_start_events` | INT64 | Count of session-start events |
| `app_open_count` | INT64 | Count of `App_open` events |
| `first_event_at` | TIMESTAMP | First event timestamp of the day |
| `last_event_at` | TIMESTAMP | Last event timestamp of the day |
| `identifications` | INT64 | Count of `Identification_done` events |
| `identifications_success` | INT64 | Count of `identification_done_success` events |
| `subscription_confirms` | INT64 | Count of `Subs_confirm` events |
| `registration_or_install_signals` | INT64 | Count of `Registration` or `first_open` events |

**Dashboard usage:** DAU = `COUNT(DISTINCT resolved_user_id)` grouped by `event_date`.

---

## v_monthly_active_users

One row per `resolved_user_id` per calendar month with activity.

| Column | Type | Description |
|--------|------|-------------|
| `activity_month` | DATE | First day of calendar month |
| `resolved_user_id` | STRING | User identity |
| `user_pseudo_id` | STRING | GA4 device identifier |
| `platform` | STRING | Most frequent platform in month |
| `country` | STRING | Most frequent country in month |
| `app_version` | STRING | Most frequent app version in month |
| `active_days_in_month` | INT64 | Distinct days active in month |
| `total_events` | INT64 | Sum of daily event counts |
| `total_app_opens` | INT64 | Sum of daily app opens |
| `total_identifications` | INT64 | Sum of identifications |
| `total_identifications_success` | INT64 | Sum of successful identifications |
| `total_subscription_confirms` | INT64 | Sum of subscription confirms |
| `first_active_at_in_month` | TIMESTAMP | First activity in month |
| `last_active_at_in_month` | TIMESTAMP | Last activity in month |

**Dashboard usage:** MAU = `COUNT(DISTINCT resolved_user_id)` grouped by `activity_month`.

---

## v_new_users

One row per user with first-seen / cohort information.

| Column | Type | Description |
|--------|------|-------------|
| `resolved_user_id` | STRING | User identity |
| `user_pseudo_id` | STRING | GA4 device identifier |
| `cohort_date` | DATE | Cohort anchor: `first_open` → `Registration` → first event |
| `first_open_date` | DATE | Install date (nullable) |
| `registration_date` | DATE | Registration date (nullable) |
| `first_event_date` | DATE | Earliest event date |
| `cohort_type` | STRING | `install` / `registration` / `first_event` |
| `first_platform` | STRING | Platform at first touch |
| `first_country` | STRING | Country at first touch |
| `first_app_version` | STRING | App version at first touch |
| `first_seen_at` | TIMESTAMP | Timestamp of first event |

**Dashboard usage:** New users = `COUNT(DISTINCT resolved_user_id)` grouped by `cohort_date`.

---

## v_country_metrics

Daily KPIs aggregated by country and platform.

| Column | Type | Description |
|--------|------|-------------|
| `event_date` | DATE | Metric date |
| `country` | STRING | Country (from event param or geo) |
| `platform` | STRING | `android` / `ios` |
| `dau` | INT64 | Daily active users |
| `new_users` | INT64 | New users that day |
| `total_events` | INT64 | Total event count |
| `identifications_success` | INT64 | Successful identifications |
| `identifications_failure` | INT64 | Failed identifications |
| `subscription_confirms` | INT64 | Subscription confirmations |
| `subs_page_views` | INT64 | Paywall impressions |
| `registrations` | INT64 | Registration events |
| `logins` | INT64 | Login events |
| `identification_success_rate` | FLOAT64 | Success / (success + failure) |
| `subs_conversion_rate` | FLOAT64 | Confirms / paywall views |

**Dashboard usage:** Top countries = `SUM(dau)` or `SUM(new_users)` grouped by `country`.

---

## v_retention_cohorts

Retention metrics by cohort date, platform, country, and app version.

| Column | Type | Description |
|--------|------|-------------|
| `cohort_date` | DATE | Cohort install/registration date |
| `cohort_type` | STRING | `install` / `registration` / `first_event` |
| `platform` | STRING | Platform at cohort entry |
| `country` | STRING | Country at cohort entry |
| `app_version` | STRING | App version at cohort entry |
| `cohort_size` | INT64 | Users in cohort |
| `retained_d1` | INT64 | Users who returned on day 1 |
| `retained_d7` | INT64 | Users who returned on day 7 |
| `retained_d14` | INT64 | Users who returned on day 14 |
| `retained_d30` | INT64 | Users who returned on day 30 |
| `retention_d1_rate` | FLOAT64 | D1 retention rate |
| `retention_d7_rate` | FLOAT64 | D7 retention rate |
| `retention_d14_rate` | FLOAT64 | D14 retention rate |
| `retention_d30_rate` | FLOAT64 | D30 retention rate |

**Dashboard usage:** D1/D7 KPI cards = weighted average of `retention_d1_rate` / `retention_d7_rate`.

**Maturity rule:** Exclude cohorts where `cohort_date + N days > CURRENT_DATE()`.

---

## v_events_normalized (reference)

Base normalized event stream. Used by `07_top_events.sql` when view-based event analysis is needed.

Key columns: `event_date`, `event_name`, `event_name_base`, `resolved_user_id`, `platform`, `country`, `app_version`, plus flattened event params.

See `sql/01_v_events_normalized.sql` for full column list.

---

## Product metric views (Banknote)

Full mapping: `docs/banknote-product-metrics.md`  
Dashboard SQL: `sql/dashboard/product/`  
Deploy: `./scripts/deploy-product-metrics.sh`

### v_identify_metrics

Daily Identify funnel and quality.

| Column | Description |
|--------|-------------|
| `users_identify_open` … `users_success` | Funnel unique users |
| `identification_success_rate` | success / (success + failure) |
| `no_match_rate` | Trust / coverage signal |
| `free_quota_hit_rate` | Free users who hit scan limit |
| `camera_permission_grant_rate` | Optional #19 |

### v_time_to_first_scan

| Column | Description |
|--------|-------------|
| `day0_first_scan_rate` | % of cohort with successful ID on cohort day |
| `median_seconds_to_first_scan` | Median seconds from first_seen → first success |

### v_scan_experiment_metrics

> **Not in MVP.** Free-scan variant comparison was removed from the product dashboard.
> View remains available for ad-hoc analysis only.

| Column | Description |
|--------|-------------|
| `scan_limit_variant` | Experiment arm |
| `avg_scans_per_user_d7` | Engagement by arm |
| `retention_d1_rate` / `retention_d7_rate` | Retention by arm |
| `pro_conversion_d7_rate` / `pro_conversion_d30_rate` | Monetization by arm |

### v_engagement_metrics

| Column | Description |
|--------|-------------|
| `scans_per_dau` | Successful IDs / DAU |
| `collection_add_rate_after_id` | Same-day add to collection after success |
| `collection_open_rate` / `marketplace_engagement_rate` / `feed_engagement_rate` | Catalogue / marketplace / feed |

### v_product_kpi_daily

One row per day for Overview scorecards: DAU, installs, scans/user, identify success, quota hit, paywall conversion, day-0 first scan.
MVP cards also use funnel / catalogue / marketplace queries (`08`–`10`).

---

## Filter column mapping

| Dashboard filter | Maps to column(s) |
|------------------|-------------------|
| Date Range | `event_date`, `cohort_date`, `activity_month` |
| Country | `country`, `first_country` |
| Platform | `platform`, `first_platform` |
