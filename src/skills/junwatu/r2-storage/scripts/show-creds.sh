#!/bin/bash
# R2 Show Credentials
# Usage: show-creds.sh [--raw]

set -e

ENV_FILE="$HOME/.config/r2/env"
CONFIG_FILE="$HOME/.config/rclone/rclone.conf"

# Try env file first, fallback to rclone config
if [[ -f "$ENV_FILE" ]]; then
    source "$ENV_FILE"
    ACCESS_KEY="${R2_ACCESS_KEY_ID}"
    SECRET_KEY="${R2_SECRET_ACCESS_KEY}"
    ENDPOINT="${R2_ENDPOINT}"
    BUCKET="${R2_BUCKET}"
elif [[ -f "$CONFIG_FILE" ]]; then
    REMOTE="${R2_REMOTE:-r2}"
    ACCESS_KEY=$(grep -A10 "^\[${REMOTE}\]" "$CONFIG_FILE" | grep "access_key_id" | cut -d'=' -f2 | tr -d ' ')
    SECRET_KEY=$(grep -A10 "^\[${REMOTE}\]" "$CONFIG_FILE" | grep "secret_access_key" | cut -d'=' -f2 | tr -d ' ')
    ENDPOINT=$(grep -A10 "^\[${REMOTE}\]" "$CONFIG_FILE" | grep "endpoint" | cut -d'=' -f2 | tr -d ' ')
    BUCKET=""
else
    echo "❌ R2 config not found. Run setup first."
    exit 1
fi

if [[ "$1" == "--raw" ]]; then
    echo "R2_ACCESS_KEY_ID=$ACCESS_KEY"
    echo "R2_SECRET_ACCESS_KEY=$SECRET_KEY"
    echo "R2_ENDPOINT=$ENDPOINT"
    [[ -n "$BUCKET" ]] && echo "R2_BUCKET=$BUCKET"
else
    echo "☁️ R2 Credentials"
    echo "================="
    echo ""
    echo "Access Key ID:"
    echo "  $ACCESS_KEY"
    echo ""
    echo "Secret Key:"
    echo "  $SECRET_KEY"
    echo ""
    echo "Endpoint:"
    echo "  $ENDPOINT"
    [[ -n "$BUCKET" ]] && echo "" && echo "Bucket:" && echo "  $BUCKET"
    echo ""
    echo "Use --raw for machine-readable output"
fi
