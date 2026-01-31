#!/bin/bash
# List all checkpoints
CHECKPOINT_DIR="${CHECKPOINT_DIR:-memory/checkpoints}"

echo "=== Context Checkpoints ==="
if [ -d "$CHECKPOINT_DIR" ]; then
  ls -lt "$CHECKPOINT_DIR"/*.md 2>/dev/null | head -20 | while read -r line; do
    file=$(echo "$line" | awk '{print $NF}')
    desc=$(grep "^\*\*Description:\*\*" "$file" 2>/dev/null | head -1 | sed 's/\*\*Description:\*\* //')
    echo "$(basename "$file"): $desc"
  done
  
  echo ""
  echo "Latest: $(readlink "$CHECKPOINT_DIR/latest.md" 2>/dev/null || echo "none")"
else
  echo "No checkpoints yet."
fi
