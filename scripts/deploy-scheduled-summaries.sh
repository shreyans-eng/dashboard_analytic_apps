#!/usr/bin/env bash
# Deploy analytics_summary scheduled SQL (manual one-time run)
set -euo pipefail

PROJECT="${PROJECT:-banknote-app-4f3fd}"
DATASET="${DATASET:-analytics_488476338}"
SQL_DIR="$(dirname "$0")/../sql/scheduled"

echo "Creating analytics_summary dataset if missing..."
bq mk --dataset --location=US "${PROJECT}:analytics_summary" 2>/dev/null || true

for f in daily_active_users monthly_active_users daily_new_users daily_retention \
         country_metrics platform_metrics top_events; do
  echo "Running sql/scheduled/${f}.sql ..."
  sed "s/{PROJECT}/${PROJECT}/g; s/{DATASET}/${DATASET}/g" \
    "${SQL_DIR}/${f}.sql" | bq query --use_legacy_sql=false --project_id="${PROJECT}"
done

echo "Done. Verify: bq ls ${PROJECT}:analytics_summary"
