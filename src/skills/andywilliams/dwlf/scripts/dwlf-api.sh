#!/usr/bin/env bash
# dwlf-api.sh — Generic DWLF API wrapper
# Usage: dwlf-api.sh METHOD PATH [BODY]
# Examples:
#   dwlf-api.sh GET /market-data/BTC-USD
#   dwlf-api.sh GET "/events?symbol=BTC-USD&limit=10"
#   dwlf-api.sh POST /visual-backtests '{"strategyId":"abc"}'

set -euo pipefail

METHOD="${1:?Usage: dwlf-api.sh METHOD PATH [BODY]}"
PATH_AND_QUERY="${2:?Usage: dwlf-api.sh METHOD PATH [BODY]}"
BODY="${3:-}"

API_BASE="${DWLF_API_URL:-https://api.dwlf.co.uk}/v2"
API_KEY="${DWLF_API_KEY:-}"

# Try reading from TOOLS.md if no env var set
if [ -z "$API_KEY" ]; then
  TOOLS_FILE="${TOOLS_MD:-$HOME/clawd/TOOLS.md}"
  if [ -f "$TOOLS_FILE" ]; then
    # Extract Jenna's API key from TOOLS.md
    API_KEY=$(grep -A1 "Jenna's own key" "$TOOLS_FILE" | grep "API Key:" | head -1 | sed 's/.*: //')
  fi
fi

if [ -z "$API_KEY" ]; then
  echo "Error: No API key found. Set DWLF_API_KEY or add to TOOLS.md" >&2
  exit 1
fi

URL="${API_BASE}${PATH_AND_QUERY}"

CURL_ARGS=(
  -s
  -X "$METHOD"
  -H "Content-Type: application/json"
  -H "Authorization: ApiKey ${API_KEY}"
)

if [ -n "$BODY" ]; then
  CURL_ARGS+=(-d "$BODY")
fi

curl "${CURL_ARGS[@]}" "$URL" | jq .
