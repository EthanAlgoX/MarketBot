#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="$HOME/.onedrive-mcp"
CONFIG_FILE="$CONFIG_DIR/config.json"
CREDS_FILE="$CONFIG_DIR/credentials.json"

SCOPES="Files.ReadWrite offline_access"
# Use /common so an Entra-registered multi-tenant app can authenticate personal Microsoft accounts too.
TENANT="common"
DEVICE_URL="https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/devicecode"
TOKEN_URL="https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

need_bin() {
  command -v "$1" >/dev/null 2>&1 || { echo -e "${RED}Missing dependency: $1${NC}"; exit 1; }
}

need_bin curl
need_bin jq

mkdir -p "$CONFIG_DIR"

echo -e "${BLUE}=== OneDrive (Consumer) OAuth Setup ===${NC}"
echo

if [[ -f "$CONFIG_FILE" ]]; then
  echo -e "Found existing config: ${CONFIG_FILE}"
  echo -n "Reuse it? [Y/n] "
  read -r ans
  if [[ "${ans:-Y}" =~ ^[Yy]$ ]]; then
    CLIENT_ID=$(jq -r '.client_id' "$CONFIG_FILE")
    CLIENT_SECRET=$(jq -r '.client_secret // empty' "$CONFIG_FILE")
  fi
fi

if [[ -z "${CLIENT_ID:-}" || "${CLIENT_ID}" == "null" ]]; then
  echo "Enter your App Registration Client ID (Application ID):"
  read -r CLIENT_ID
fi

if [[ -z "${CLIENT_SECRET:-}" || "${CLIENT_SECRET}" == "null" ]]; then
  echo
  echo "Client Secret is optional for device code flow (public client)."
  echo -n "Do you want to store a client secret anyway? [y/N] "
  read -r want
  if [[ "${want:-N}" =~ ^[Yy]$ ]]; then
    echo "Paste Client Secret value:"
    read -r CLIENT_SECRET
  else
    CLIENT_SECRET=""
  fi
fi

cat > "$CONFIG_FILE" <<EOF
{
  "client_id": "${CLIENT_ID}",
  "client_secret": "${CLIENT_SECRET}"
}
EOF
chmod 600 "$CONFIG_FILE"

echo
echo -e "${YELLOW}Step 1: Requesting device code...${NC}"
DEVICE_JSON=$(curl -sS -X POST "$DEVICE_URL" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "client_id=${CLIENT_ID}" \
  --data-urlencode "scope=${SCOPES}")

USER_CODE=$(echo "$DEVICE_JSON" | jq -r '.user_code')
VERIF_URI=$(echo "$DEVICE_JSON" | jq -r '.verification_uri')
VERIF_URI_COMPLETE=$(echo "$DEVICE_JSON" | jq -r '.verification_uri_complete')
INTERVAL=$(echo "$DEVICE_JSON" | jq -r '.interval')
DEVICE_CODE=$(echo "$DEVICE_JSON" | jq -r '.device_code')

if [[ -z "$DEVICE_CODE" || "$DEVICE_CODE" == "null" ]]; then
  echo -e "${RED}Failed to get device code:${NC}"
  echo "$DEVICE_JSON" | jq .
  exit 1
fi

echo
echo -e "Open: ${BLUE}${VERIF_URI}${NC}"
echo -e "Enter code: ${BLUE}${USER_CODE}${NC}"
echo
if [[ -n "$VERIF_URI_COMPLETE" && "$VERIF_URI_COMPLETE" != "null" ]]; then
  echo -e "Direct link: ${BLUE}${VERIF_URI_COMPLETE}${NC}"
fi

echo
echo -e "${YELLOW}Step 2: Waiting for authorization...${NC}"

# Poll token endpoint
while true; do
  # Build form body
  if [[ -n "$CLIENT_SECRET" ]]; then
    RESP=$(curl -sS -X POST "$TOKEN_URL" \
      -H 'Content-Type: application/x-www-form-urlencoded' \
      --data-urlencode "client_id=${CLIENT_ID}" \
      --data-urlencode "client_secret=${CLIENT_SECRET}" \
      --data-urlencode "grant_type=urn:ietf:params:oauth:grant-type:device_code" \
      --data-urlencode "device_code=${DEVICE_CODE}")
  else
    RESP=$(curl -sS -X POST "$TOKEN_URL" \
      -H 'Content-Type: application/x-www-form-urlencoded' \
      --data-urlencode "client_id=${CLIENT_ID}" \
      --data-urlencode "grant_type=urn:ietf:params:oauth:grant-type:device_code" \
      --data-urlencode "device_code=${DEVICE_CODE}")
  fi

  if echo "$RESP" | jq -e '.access_token' >/dev/null 2>&1; then
    echo "$RESP" > "$CREDS_FILE"
    chmod 600 "$CREDS_FILE"
    echo -e "${GREEN}✓ Tokens saved to ${CREDS_FILE}${NC}"
    break
  fi

  ERR=$(echo "$RESP" | jq -r '.error // empty')
  DESC=$(echo "$RESP" | jq -r '.error_description // empty')

  if [[ "$ERR" == "authorization_pending" ]]; then
    sleep "${INTERVAL:-5}"
    continue
  fi

  if [[ "$ERR" == "slow_down" ]]; then
    sleep $(( (${INTERVAL:-5}) + 5 ))
    continue
  fi

  if [[ "$ERR" == "invalid_client" ]] && echo "$DESC" | grep -qi "marked as.*mobile"; then
    echo -e "${RED}Token request failed: invalid_client (app not allowed for device-code)${NC}"
    echo "Fix: In Entra App Registration → Authentication → enable 'Allow public client flows'."
    echo "In some tenants you also need isFallbackPublicClient=true."
    echo "Raw error: $DESC"
    exit 1
  fi

  echo -e "${RED}Token request failed:${NC} ${ERR}"
  if [[ -n "$DESC" ]]; then
    echo "$DESC"
  else
    echo "$RESP" | jq .
  fi
  exit 1

done

echo
echo -e "${YELLOW}Step 3: Testing OneDrive access...${NC}"
ACCESS_TOKEN=$(jq -r '.access_token' "$CREDS_FILE")
ME=$(curl -sS "https://graph.microsoft.com/v1.0/me/drive" -H "Authorization: Bearer ${ACCESS_TOKEN}")
if echo "$ME" | jq -e '.id' >/dev/null 2>&1; then
  echo -e "${GREEN}✓ OneDrive ready.${NC}"
  echo "$ME" | jq '{driveId:.id, owner:(.owner.user.displayName // .owner.user.id), driveType:.driveType}'
else
  echo -e "${RED}Failed to access OneDrive:${NC}"
  echo "$ME" | jq .
  exit 1
fi

echo
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo "Try: ./scripts/onedrive-cli.sh ls /"
