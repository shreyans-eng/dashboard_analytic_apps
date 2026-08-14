#!/usr/bin/env bash
# Grant BigQuery permissions to the Firebase service account key already uploaded to Metabase.
# Run in Terminal.app after: brew install --cask google-cloud-sdk
set -euo pipefail

PROJECT="banknote-app-4f3fd"
DATASET="analytics_488476338"
KEY_FILE="${1:-$HOME/Downloads/banknote-app-4f3fd-0d7d8e5fab12.json}"

GCLOUD="/opt/homebrew/share/google-cloud-sdk/bin/gcloud"
[[ -x "$GCLOUD" ]] || GCLOUD="$(command -v gcloud || true)"
if [[ -z "$GCLOUD" ]]; then
  echo "Install gcloud first: brew install --cask google-cloud-sdk"
  exit 1
fi

if [[ ! -f "$KEY_FILE" ]]; then
  echo "Key file not found: $KEY_FILE"
  echo "Usage: $0 [/path/to/service-account.json]"
  exit 1
fi

SA_EMAIL=$(python3 -c "import json; print(json.load(open('$KEY_FILE'))['client_email'])")
echo "Service account: $SA_EMAIL"
echo "Project:         $PROJECT"
echo "Dataset:         $DATASET"
echo ""

if ! "$GCLOUD" auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q .; then
  echo "Logging in to Google Cloud..."
  "$GCLOUD" auth login
fi

"$GCLOUD" config set project "$PROJECT"

echo ">>> Granting BigQuery Data Viewer..."
"$GCLOUD" projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/bigquery.dataViewer" \
  --quiet

echo ">>> Granting BigQuery Job User..."
"$GCLOUD" projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/bigquery.jobUser" \
  --quiet

echo ">>> Verifying dataset access..."
if "$GCLOUD" bq show --project_id="$PROJECT" "${PROJECT}:${DATASET}" &>/dev/null; then
  TABLE_COUNT=$("$GCLOUD" bq query --use_legacy_sql=false --format=csv \
    "SELECT COUNT(*) FROM \`${PROJECT}.${DATASET}.__TABLES__\` WHERE table_id LIKE 'events_%'" | tail -1)
  echo "Dataset OK — $TABLE_COUNT events_* tables found."
else
  echo "WARNING: Dataset ${PROJECT}:${DATASET} not found."
  echo "Check Firebase → BigQuery integration and dataset name."
fi

echo ""
echo "=============================================="
echo " DONE — Now in Metabase:"
echo "   1. http://localhost:3000/admin/databases/2/edit"
echo "   2. Datasets → set to 'All' (test) or keep analytics_488476338"
echo "   3. Save → Sync database schema now"
echo "=============================================="
