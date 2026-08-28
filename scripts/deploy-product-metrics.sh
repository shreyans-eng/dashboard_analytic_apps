#!/usr/bin/env bash
# Deploy Banknote product-metric views to BigQuery.
# Usage:
#   export GCP_PROJECT=banknote-app-4f3fd
#   export BQ_DATASET=analytics_488476338
#   ./scripts/deploy-product-metrics.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="${GCP_PROJECT:-banknote-app-4f3fd}"
DATASET="${BQ_DATASET:-analytics_488476338}"

FILES=(
  sql/07_v_subscription_metrics.sql
  sql/08_v_identify_metrics.sql
  sql/10_v_engagement_metrics.sql
  sql/14_v_time_to_first_scan.sql
)

echo "Deploying product metrics to ${PROJECT}.${DATASET}"

for f in "${FILES[@]}"; do
  echo "→ $f"
  sed "s/{PROJECT}/${PROJECT}/g; s/{DATASET}/${DATASET}/g" "$ROOT/$f" \
    | bq query --use_legacy_sql=false --project_id="$PROJECT"
done

echo "Done. Wire cards from sql/dashboard/product/"
