#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="$HOME/.onedrive-mcp"
CONFIG_FILE="$CONFIG_DIR/config.json"
CREDS_FILE="$CONFIG_DIR/credentials.json"

# Use /common for refresh as well (matches device-code flow).
# Use /common for refresh as well (matches device-code flow).
TENANT="common"
TOKEN_URL="https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token"

need_bin() { command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1"; exit 1; }; }
need_bin curl
need_bin jq

if [[ ! -f "$CONFIG_FILE" || ! -f "$CREDS_FILE" ]]; then
  echo "Missing config/credentials. Run: ./scripts/onedrive-setup.sh"
  exit 1
fi

CLIENT_ID=$(jq -r '.client_id' "$CONFIG_FILE")
CLIENT_SECRET=$(jq -r '.client_secret // empty' "$CONFIG_FILE")
REFRESH_TOKEN=$(jq -r '.refresh_token' "$CREDS_FILE")

if [[ -z "$REFRESH_TOKEN" || "$REFRESH_TOKEN" == "null" ]]; then
  echo "No refresh_token found. Re-run setup."
  exit 1
fi

if [[ -n "$CLIENT_SECRET" ]]; then
  RESP=$(curl -sS -X POST "$TOKEN_URL" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode "client_id=${CLIENT_ID}" \
    --data-urlencode "client_secret=${CLIENT_SECRET}" \
    --data-urlencode "grant_type=refresh_token" \
    --data-urlencode "refresh_token=${REFRESH_TOKEN}" \
    --data-urlencode "scope=Files.ReadWrite offline_access")
else
  RESP=$(curl -sS -X POST "$TOKEN_URL" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode "client_id=${CLIENT_ID}" \
    --data-urlencode "grant_type=refresh_token" \
    --data-urlencode "refresh_token=${REFRESH_TOKEN}" \
    --data-urlencode "scope=Files.ReadWrite offline_access")
fi

if echo "$RESP" | jq -e '.access_token' >/dev/null 2>&1; then
  echo "$RESP" > "$CREDS_FILE"
  chmod 600 "$CREDS_FILE"
  echo "refreshed: ok"
else
  echo "refresh failed"
  echo "$RESP" | jq '.error, .error_description'
  exit 1
fi
