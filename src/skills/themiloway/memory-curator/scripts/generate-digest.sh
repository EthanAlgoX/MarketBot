#!/bin/bash
# generate-digest.sh — Generate a skeleton digest from a daily log
#
# Usage: generate-digest.sh [YYYY-MM-DD]
# If no date given, uses today (UTC)

set -e

MEMORY_DIR="$HOME/clawd/memory"
DATE="${1:-$(date -u +%Y-%m-%d)}"
LOG_FILE="$MEMORY_DIR/$DATE.md"
DIGEST_FILE="$MEMORY_DIR/digests/$DATE-digest.md"

# Check if log exists
if [ ! -f "$LOG_FILE" ]; then
  echo "Error: No log found at $LOG_FILE"
  exit 1
fi

# Extract stats
TOTAL_LINES=$(wc -l < "$LOG_FILE")
SECTION_COUNT=$(grep -c "^## " "$LOG_FILE" || echo 0)
H3_COUNT=$(grep -c "^### " "$LOG_FILE" || echo 0)

# Extract timestamps (look for patterns like "~HH:MM UTC" or "HH:MM UTC")
TIMESTAMPS=$(grep -oE '[0-9]{1,2}:[0-9]{2} UTC' "$LOG_FILE" | sort -u)
FIRST_TIME=$(echo "$TIMESTAMPS" | head -1)
LAST_TIME=$(echo "$TIMESTAMPS" | tail -1)

# Extract section titles
SECTIONS=$(grep "^## " "$LOG_FILE" | sed 's/^## //')

# Extract people mentioned (bold names pattern)
# Filter out common false positives
PEOPLE=$(grep -oE '\*\*[A-Z][a-z]+\*\*' "$LOG_FILE" | sort -u | sed 's/\*\*//g' | \
  grep -v -E '^(Note|Key|What|My|The|API|Stats|Feed|Post|URL|Title|Name|Usage|Error|Implication|Date|Summary|Status|Location|Topic|Who|Project)$' || echo "")

# Extract moltbook usernames (both capitalized and lowercase bold names that look like usernames)
# Combine: **lowercase** names + **Capitalized** names that appear after specific patterns
MOLTYS=$(grep -oE '\*\*[A-Za-z][A-Za-z0-9_-]+\*\*' "$LOG_FILE" | sort | uniq -c | sort -rn | \
  awk '$1 >= 1 {print $2}' | sed 's/\*\*//g' | \
  grep -v -E '^(Note|Key|What|My|The|API|Stats|Feed|Post|URL|Title|Name|Usage|Error|Implication|Date|Summary|Status|Location|Topic|Who|Project|Moltbook|Session|Check|Update|Research|Exploration|Cron|Heartbeat|Morning|Evening|Noon|Memory|Curator|Autonomy|Granted|Reflection|California)$' | \
  head -30 || echo "")

# Extract final karma value (look for "Karma: X" or "karma: X" patterns, get the last/highest)
KARMA_FINAL=$(grep -oE '[Kk]arma:? ?[0-9]+' "$LOG_FILE" | grep -oE '[0-9]+' | sort -n | tail -1 || echo "unknown")

# Generate digest skeleton
mkdir -p "$MEMORY_DIR/digests"

cat > "$DIGEST_FILE" << EOF
# Digest: $DATE

*Generated: $(date -u "+%Y-%m-%d %H:%M UTC")*
*Source: $LOG_FILE ($TOTAL_LINES lines)*

## Summary

<!-- Write 2-3 sentence summary of the day -->

## Stats

- **Lines:** $TOTAL_LINES
- **Sections:** $SECTION_COUNT major, $H3_COUNT minor
- **Time span:** ${FIRST_TIME:-unknown} → ${LAST_TIME:-unknown}
- **Karma:** ${KARMA_FINAL:-unknown}

## Key Events

<!-- List the most important things that happened -->

$(echo "$SECTIONS" | while read -r section; do
  [ -n "$section" ] && echo "- $section"
done)

## Learnings

<!-- What did I learn today? -->

- 

## Connections

<!-- People I interacted with -->

### Moltbook
$(if [ -n "$MOLTYS" ]; then
  echo "$MOLTYS" | while read -r name; do
    [ -n "$name" ] && echo "- **$name** — "
  done
else
  echo "- (none detected)"
fi)

### Other
$(if [ -n "$PEOPLE" ]; then
  echo "$PEOPLE" | while read -r name; do
    [ -n "$name" ] && echo "- **$name** — "
  done
else
  echo "- (none detected)"
fi)

## Open Questions

<!-- What am I still thinking about? -->

- 

## Tomorrow

<!-- What should future-me prioritize? -->

- 

---

*Raw sections found:*
\`\`\`
$SECTIONS
\`\`\`
EOF

echo "✅ Generated digest skeleton: $DIGEST_FILE"
echo "   Source: $LOG_FILE ($TOTAL_LINES lines)"
echo "   Sections found: $SECTION_COUNT"
echo ""
echo "Next: Review and fill in the <!-- comments --> sections"
