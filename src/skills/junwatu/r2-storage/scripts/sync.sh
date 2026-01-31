#!/bin/bash
# R2 Sync Script
# Usage: sync.sh <source> <dest>
# Examples:
#   sync.sh /local/folder/ r2:bucket/      # Local → R2
#   sync.sh r2:bucket/ /local/folder/      # R2 → Local
#   sync.sh /local/ r2:bucket/ --delete    # Mirror with deletion

set -e

DELETE=""
DIRECTION="push"

while [[ $# -gt 0 ]]; do
    case $1 in
        --delete)
            DELETE="--delete"
            shift
            ;;
        *)
            SRC="$1"
            DST="$2"
            shift 2
            ;;
    esac
done

if [[ -z "$SRC" || -z "$DST" ]]; then
    echo "Usage: sync.sh <source> <dest> [--delete]"
    echo "  source: local path or r2:bucket/"
    echo "  dest: local path or r2:bucket/"
    exit 1
fi

rclone sync "$SRC" "$DST" $DELETE -P
echo "✅ Synced: $SRC → $DST"
