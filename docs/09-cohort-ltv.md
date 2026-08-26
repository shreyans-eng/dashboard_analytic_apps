# Cohort LTV (Explorer)

LTV-30 / LTV-90 / LTV-180 by **install cohort date × country × Organic / Paid / Direct**.

Dashboard: **Explorer → Cohort LTV** (`/ltv`). Banknote and Coinzy stay on separate BigQuery projects.

## Formula

```text
LTV-N = revenue in the N days after install ÷ installs in the cohort
```

Windows are inclusive of install day:

| Metric | Revenue window | Mature when |
|--------|----------------|-------------|
| LTV-30 | Day 0–29 | cohort age ≥ 30 days |
| LTV-90 | Day 0–89 | cohort age ≥ 90 days |
| LTV-180 | Day 0–179 | cohort age ≥ 180 days |

Immature windows are **NULL**, not partial LTV. The dashboard date range is **install (cohort) dates**, not calendar revenue.

Grain stored: `cohort_date × country × install_channel × platform`. The Explorer page rolls platform up unless you filter it.

## What was reused

- Same identity as the rest of analytics: `COALESCE(user_id, event_params.user_id, user_pseudo_id)`.
- Same country-at-event rule as explorer tabs: `COALESCE(event_params.country, geo.country, 'Unknown')`, taken from the user’s **first** `first_open` (not later purchases).
- Same `first_open` cohort idea as New Users / D1 / D7 (earliest `first_open` per user).
- Same summary → raw fallback as other Explorer metrics (`analytics_summary.cohort_ltv`, then `sql/dashboard/raw/10_cohort_ltv.sql`).
- **Not** reused: `v_attribution_metrics` (UTM-first; `collected_traffic_source` on `first_open` is empty here) and `v_subscription_metrics` / `Subs_confirm` (confirmation counts, not USD).

## Organic / Paid / Direct

Frozen on the **first** `first_open` only (`traffic_source`, then `collected_traffic_source`, then UTM). Later sessions and `session_traffic_source_last_click` do not change the channel.

Verified on Coinzy + Banknote `first_open` (Aug 2026):

| Channel | Typical `traffic_source` |
|---------|--------------------------|
| **Organic** | `google-play` / `organic`, `google` / `organic` |
| **Paid** | `google` / `cpc` (and other paid media: cpc, ppc, cpm, display, uac, … or a `gclid`) |
| **Direct** | `(direct)` / `(none)` |

Empty UTM is **not** treated as Direct when `traffic_source` is present. Residual rows with no source/medium at all are classified Direct so every install is Organic, Paid, or Direct (no fourth bucket).

## Revenue

USD from GA4 monetary fields on `in_app_purchase` / `purchase` only:

1. `event_value_in_usd`
2. else `event_params.value` (double / float / int)

`refund` subtracts when present. **Not used:** `Subs_confirm` / `subs_confirm`, Coinzy `paid_purchase` / `paid_purchase_ga4` (not verified as USD). Pack prices are not invented.

Trials and renewals appear only if Play/App Store reports them as those purchase events with a value. There is no separate trial flag in this export.

## SQL & refresh

| Piece | Path |
|-------|------|
| Raw fallback | `sql/dashboard/raw/10_cohort_ltv.sql` |
| Dashboard read | `sql/dashboard/summary/10_cohort_ltv.sql` |
| Materialize | `sql/scheduled/cohort_ltv.sql` → `{project}.analytics_summary.cohort_ltv` |
| Checks | `sql/validation/06_cohort_ltv.sql` |

```bash
# LTV lookback defaults to 210 days even if DAYS is smaller (needed for LTV-180)
PRODUCT=coinzy DAYS=30 npm run refresh-summaries:product
PRODUCT=banknote LTV_DAYS=210 npm run refresh-summaries:product
```

Explicit `START=` is respected (no auto-expand) so you can backfill a slice.

## Dashboard

Filters: cohort date range, country (including Unknown), platform, channel. Compare-apps mode is disabled on this page (pick Banknote or Coinzy). Default 30-day range will show LTV-30 for mature days only; widen the install-date range for LTV-90 / LTV-180.

## Limitations

- Windowed `first_open` scans cannot see an earlier install *before* the scanned event range; same constraint as other cohort SQL.
- Users who only get a `user_id` after install may still split across a pseudo-id and a later id.
- IAP volume is low vs installs; many mature cohorts will have LTV $0.00, which is valid.
- If `event_value_in_usd` and `value` are both missing, that purchase is skipped (not filled with a guessed pack price).
