#!/usr/bin/env bash
# Deploy BigQuery analytics views for Coinzy
# Usage: PROJECT=coinzy-prod DATASET=analytics_123456789 ./deploy-views.sh

set -euo pipefail

PROJECT="${PROJECT:?Set PROJECT env var}"
DATASET="${DATASET:?Set DATASET env var}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for f in "$SCRIPT_DIR"/sql/0*.sql; do
  echo "Deploying $(basename "$f") ..."
  sed "s/{PROJECT}/${PROJECT}/g; s/{DATASET}/${DATASET}/g" "$f" \
    | bq query --use_legacy_sql=false --project_id="$PROJECT"
done

echo "Done. Views deployed to ${PROJECT}.${DATASET}"
