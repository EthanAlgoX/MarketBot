#!/bin/bash
# R2 Upload Script
# Usage: upload.sh <local_path> [--bucket NAME]

set -e

REMOTE="r2"
BUCKET="${R2_BUCKET:-moltbot-storage}"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --bucket)
            BUCKET="$2"
            shift 2
            ;;
        *)
            LOCAL_PATH="$1"
            shift
            ;;
    esac
done

if [[ -z "$LOCAL_PATH" ]]; then
    echo "Usage: upload.sh <local_path> [--bucket NAME]"
    exit 1
fi

rclone copy "$LOCAL_PATH" "${REMOTE}:${BUCKET}/"
echo "✅ Uploaded: $LOCAL_PATH → r2:${BUCKET}/"
