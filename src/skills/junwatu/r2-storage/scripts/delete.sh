#!/bin/bash
# R2 Delete Script
# Usage: delete.sh <path> [--bucket NAME] [--purge]

set -e

REMOTE="r2"
BUCKET="${R2_BUCKET:-moltbot-storage}"
PURGE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --bucket)
            BUCKET="$2"
            shift 2
            ;;
        --purge)
            PURGE="--purge"
            shift
            ;;
        *)
            PATH="$1"
            shift
            ;;
    esac
done

if [[ -n "$PURGE" ]]; then
    read -p "Delete ALL files in bucket '${BUCKET}'? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rclone delete "${REMOTE}:${BUCKET}/" --drive-trashed-only=false
        rclone rmdir "${REMOTE}:${BUCKET}/"
        echo "✅ Bucket '${BUCKET}' purged"
    else
        echo "Cancelled"
    fi
elif [[ -n "$PATH" ]]; then
    rclone delete "${REMOTE}:${BUCKET}/${PATH}"
    echo "✅ Deleted: r2:${BUCKET}/${PATH}"
else
    echo "Usage: delete.sh <path> [--bucket NAME] [--purge]"
fi
