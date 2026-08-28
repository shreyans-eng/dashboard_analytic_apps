#!/usr/bin/env bash
# Deploy analytics views to a product BigQuery dataset (Banknote or Coinzy).
# Usage:
#   GCP_PROJECT=coinzy-26a4d BQ_DATASET=analytics_487601380 \
#   GOOGLE_APPLICATION_CREDENTIALS=secrets/coinzy-analytics-dashboard-sa.json \
#   ./scripts/deploy-product-views.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="${GCP_PROJECT:?Set GCP_PROJECT}"
DATASET="${BQ_DATASET:?Set BQ_DATASET}"

FILES=(
  sql/01_v_events_normalized.sql
  sql/02_v_daily_active_users.sql
  sql/03_v_monthly_active_users.sql
  sql/04_v_new_users.sql
  sql/05_v_country_metrics.sql
  sql/06_v_retention_cohorts.sql
  sql/07_v_subscription_metrics.sql
  sql/08_v_identify_metrics.sql
  sql/10_v_engagement_metrics.sql
  sql/14_v_time_to_first_scan.sql
)

echo "Deploying views → ${PROJECT}.${DATASET}"

for f in "${FILES[@]}"; do
  echo "→ $f"
  sed "s/{PROJECT}/${PROJECT}/g; s/{DATASET}/${DATASET}/g" "$ROOT/$f" \
    | bq query --use_legacy_sql=false --project_id="$PROJECT"
done

echo "Done."
