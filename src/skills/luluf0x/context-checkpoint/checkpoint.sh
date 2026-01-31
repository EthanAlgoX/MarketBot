#!/bin/bash
# Context Checkpoint - Save conversation state before compression
# Usage: ./checkpoint.sh "Description of current context"

set -e

CHECKPOINT_DIR="${CHECKPOINT_DIR:-memory/checkpoints}"
DESCRIPTION="${1:-No description provided}"
TIMESTAMP=$(date -u +"%Y-%m-%d_%H%M")
FILENAME="${CHECKPOINT_DIR}/${TIMESTAMP}.md"

# Create checkpoint directory if needed
mkdir -p "$CHECKPOINT_DIR"

# Create checkpoint file
cat > "$FILENAME" << EOF
# Context Checkpoint: ${TIMESTAMP}

**Saved:** $(date -u +"%Y-%m-%d %H:%M UTC")
**Description:** ${DESCRIPTION}

## What I Was Doing

${DESCRIPTION}

## Open Threads / Active Tasks

<!-- Fill in: What tasks are in progress? What needs follow-up? -->
- [ ] 

## Key Decisions Made

<!-- Fill in: What did we decide? Why? -->
- 

## Important Context

<!-- Fill in: What would future-me need to know? -->


## Next Steps

<!-- Fill in: What should happen next? -->
- [ ] 

---
*Checkpoint saved by context-checkpoint skill* 🦊
EOF

# Update latest symlink
ln -sf "${TIMESTAMP}.md" "${CHECKPOINT_DIR}/latest.md"

echo "✓ Checkpoint saved: ${FILENAME}"
echo "  Symlinked to: ${CHECKPOINT_DIR}/latest.md"
