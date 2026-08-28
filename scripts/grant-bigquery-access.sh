#!/usr/bin/env bash
# Grant BigQuery permissions to a dashboard service account JSON key.
# Run after: brew install --cask google-cloud-sdk
set -euo pipefail

PROJECT="banknote-app-4f3fd"
DATASET="analytics_488476338"
KEY_FILE="${1:-}"

GCLOUD="/opt/homebrew/share/google-cloud-sdk/bin/gcloud"
[[ -x "$GCLOUD" ]] || GCLOUD="$(command -v gcloud || true)"
if [[ -z "$GCLOUD" ]]; then
  echo "Install gcloud first: brew install --cask google-cloud-sdk"
  exit 1
fi

if [[ -z "$KEY_FILE" || ! -f "$KEY_FILE" ]]; then
  echo "Usage: $0 /path/to/service-account.json"
  echo "Example: $0 secrets/bigquery-banknote-sa.json"
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

echo ""
echo " DONE — use this key via GOOGLE_APPLICATION_CREDENTIALS for the analytics dashboard."
