#!/bin/bash
# Cleanup old checkpoints - keep last N
CHECKPOINT_DIR="${CHECKPOINT_DIR:-memory/checkpoints}"
KEEP=${1:-10}  # Default: keep last 10

echo "=== Checkpoint Cleanup ==="
echo "Keeping last $KEEP checkpoints..."

if [ -d "$CHECKPOINT_DIR" ]; then
  # Get list of checkpoints (excluding latest symlink)
  files=$(ls -t "$CHECKPOINT_DIR"/*.md 2>/dev/null | grep -v latest.md || true)
  count=$(echo "$files" | wc -l)
  
  if [ "$count" -gt "$KEEP" ]; then
    to_delete=$(echo "$files" | tail -n +$((KEEP + 1)))
    echo "Deleting $(echo "$to_delete" | wc -l) old checkpoints..."
    echo "$to_delete" | xargs rm -f
    echo "✓ Done"
  else
    echo "Only $count checkpoints. Nothing to clean."
  fi
else
  echo "No checkpoint directory."
fi
