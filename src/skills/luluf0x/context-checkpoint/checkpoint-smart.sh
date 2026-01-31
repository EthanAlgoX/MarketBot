#!/bin/bash
# Smart Context Checkpoint - Full state save with structured data
# Usage: ./checkpoint-smart.sh [options]
#   -d "description"     What you were doing
#   -t "tasks"           Open tasks (newline separated)
#   -c "decisions"       Key decisions made
#   -x "context"         Important context
#   -n "next"            Next steps

set -e

CHECKPOINT_DIR="${CHECKPOINT_DIR:-memory/checkpoints}"
TIMESTAMP=$(date -u +"%Y-%m-%d_%H%M")
FILENAME="${CHECKPOINT_DIR}/${TIMESTAMP}.md"

# Defaults
DESCRIPTION="No description"
TASKS=""
DECISIONS=""
CONTEXT=""
NEXT_STEPS=""

# Parse arguments
while getopts "d:t:c:x:n:" opt; do
  case $opt in
    d) DESCRIPTION="$OPTARG" ;;
    t) TASKS="$OPTARG" ;;
    c) DECISIONS="$OPTARG" ;;
    x) CONTEXT="$OPTARG" ;;
    n) NEXT_STEPS="$OPTARG" ;;
    *) echo "Invalid option"; exit 1 ;;
  esac
done

mkdir -p "$CHECKPOINT_DIR"

# Format tasks as checklist
format_list() {
  if [ -n "$1" ]; then
    echo "$1" | while IFS= read -r line; do
      [ -n "$line" ] && echo "- [ ] $line"
    done
  else
    echo "- [ ] (none recorded)"
  fi
}

# Format decisions as list
format_bullets() {
  if [ -n "$1" ]; then
    echo "$1" | while IFS= read -r line; do
      [ -n "$line" ] && echo "- $line"
    done
  else
    echo "- (none recorded)"
  fi
}

cat > "$FILENAME" << EOF
# Context Checkpoint: ${TIMESTAMP}

**Saved:** $(date -u +"%Y-%m-%d %H:%M UTC")
**Description:** ${DESCRIPTION}

## What I Was Doing

${DESCRIPTION}

## Open Threads / Active Tasks

$(format_list "$TASKS")

## Key Decisions Made

$(format_bullets "$DECISIONS")

## Important Context

${CONTEXT:-No additional context recorded.}

## Next Steps

$(format_list "$NEXT_STEPS")

---
*Checkpoint saved by context-checkpoint skill* 🦊
EOF

ln -sf "${TIMESTAMP}.md" "${CHECKPOINT_DIR}/latest.md"

echo "✓ Checkpoint saved: ${FILENAME}"
