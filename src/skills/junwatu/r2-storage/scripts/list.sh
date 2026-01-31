#!/bin/bash
# R2 List Script
# Usage: list.sh [--bucket NAME] [--long]

set -e

REMOTE="r2"
BUCKET="${R2_BUCKET:-moltbot-storage}"
LONG=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --bucket)
            BUCKET="$2"
            shift 2
            ;;
        --long)
            LONG="--long"
            shift
            ;;
        *)
            BUCKET="$1"
            shift
            ;;
    esac
done

if [[ -n "$LONG" ]]; then
    rclone ls "${REMOTE}:${BUCKET}/"
else
    rclone lsf "${REMOTE}:${BUCKET}/"
fi
