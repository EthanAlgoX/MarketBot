#!/bin/bash
# R2 Storage Quick Setup Script
# Usage: ./setup.sh [--config JSON]

set -e

CONFIG_FILE="$HOME/.config/r2/config.json"
REMOTE_NAME="r2"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --config)
            CONFIG_JSON="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "☁️ R2 Storage Setup"
echo "=================="

# Check rclone
if ! command -v rclone &> /dev/null; then
    echo "Installing rclone..."
    curl -fsSL https://rclone.org/install.sh | sudo bash
fi

# Get config from arg or interactive
if [[ -z "$CONFIG_JSON" ]]; then
    read -p "Paste R2_CONFIG JSON: " CONFIG_JSON
fi

# Validate JSON
if ! echo "$CONFIG_JSON" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
    echo "❌ Invalid JSON format"
    exit 1
fi

# Parse JSON
ACCESS_KEY=$(echo "$CONFIG_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin).get('access_key_id',''))")
SECRET_KEY=$(echo "$CONFIG_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin).get('secret_access_key',''))")
ENDPOINT=$(echo "$CONFIG_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin).get('endpoint',''))")
BUCKET=$(echo "$CONFIG_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin).get('bucket',''))")

# Validate required
if [[ -z "$ACCESS_KEY" || -z "$SECRET_KEY" || -z "$ENDPOINT" ]]; then
    echo "❌ Error: access_key_id, secret_access_key, and endpoint are required."
    exit 1
fi

# Save config JSON
mkdir -p ~/.config/r2
echo "$CONFIG_JSON" > "$CONFIG_FILE"
echo "✅ Config saved to $CONFIG_FILE"

# Write rclone config
mkdir -p ~/.config/rclone
cat > ~/.config/rclone/rclone.conf << EOF
[${REMOTE_NAME}]
type = s3
provider = Cloudflare
access_key_id = ${ACCESS_KEY}
secret_access_key = ${SECRET_KEY}
endpoint = ${ENDPOINT}
acl = private
no_check_bucket = true
EOF
echo "✅ rclone config written"

# Test connection
echo "Testing connection..."
if rclone listremotes | grep -q "^${REMOTE_NAME}:"; then
    echo "✅ Remote '${REMOTE_NAME}' configured successfully"

    # Create bucket if specified
    if [[ -n "$BUCKET" ]]; then
        echo "Creating bucket '${BUCKET}'..."
        if rclone mkdir "${REMOTE_NAME}:${BUCKET}" 2>/dev/null; then
            echo "✅ Bucket '${BUCKET}' created"
        else
            echo "⚠️  Bucket may already exist or permissions issue"
        fi
    fi
else
    echo "❌ Failed to configure remote"
    exit 1
fi

echo ""
echo "Quick Reference:"
echo "  Upload: rclone copy file.txt ${REMOTE_NAME}:${BUCKET:-bucket}/"
echo "  Download: rclone copy ${REMOTE_NAME}:${BUCKET:-bucket}/file.txt ./"
echo "  List: rclone ls ${REMOTE_NAME}:${BUCKET:-bucket}/"
