#!/bin/bash
# R2 Download Script
# Usage: download.sh <remote_path> [local_dest]

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
            REMOTE_PATH="$1"
            shift
            ;;
    esac
done

if [[ -z "$REMOTE_PATH" ]]; then
    echo "Usage: download.sh <remote_path> [--bucket NAME] [local_dest]"
    exit 1
fi

DEST="${2:-.}"

if [[ -d "$DEST" ]]; then
    rclone copy "${REMOTE}:${BUCKET}/${REMOTE_PATH}" "$DEST/"
else
    rclone copyto "${REMOTE}:${BUCKET}/${REMOTE_PATH}" "$DEST"
fi

echo "✅ Downloaded: r2:${BUCKET}/${REMOTE_PATH} → $DEST"
