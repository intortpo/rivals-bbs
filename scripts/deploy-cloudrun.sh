#!/usr/bin/env bash
set -e

# Airsoft BBS - Google Cloud Run Deployment Script
# Usage: ./scripts/deploy-cloudrun.sh <PROJECT_ID> [REGION]

set -euo pipefail

PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null || echo "foxlight-489607")}"
REGION="${2:-asia-southeast1}"
SERVICE_NAME="airsoft-bbs"

echo "=============================================="
echo "🚀 Deploying Airsoft BBS to Google Cloud Run"
echo "Project: $PROJECT_ID"
echo "Region:  $REGION"
echo "Service: $SERVICE_NAME"
echo "=============================================="

# Ensure gcloud CLI is authenticated
ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null)
if [ -z "$ACCOUNT" ]; then
  echo "❌ Error: No active gcloud account found. Run 'gcloud auth login' first."
  exit 1
fi
echo "✓ Authenticated as: $ACCOUNT"

# Deploy to Cloud Run using source build
# --session-affinity is crucial for Socket.IO WebSocket connections!
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --session-affinity \
  --cpu 1 \
  --memory 1Gi \
  --min-instances 0 \
  --max-instances 5

echo ""
echo "🎉 Deployment command completed!"
URL=$(gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format="value(status.url)" 2>/dev/null || echo "")
if [ -n "$URL" ]; then
  echo "🌐 Live Public URL: $URL"
fi
