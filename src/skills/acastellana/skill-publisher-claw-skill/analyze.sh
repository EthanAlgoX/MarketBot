#!/bin/bash
#
# Skill Analyzer
# Analyze skill size, complexity, and estimate token usage
#
# Usage: ./analyze.sh [skill-directory]
#

SKILL_DIR="${1:-.}"
cd "$SKILL_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${BLUE}📊 Analyzing skill:${NC} $(basename "$(pwd)")"
echo "   Path: $(pwd)"
echo ""

# ============================================
# FILE ANALYSIS
# ============================================
echo "━━━ FILES ━━━"

TOTAL_BYTES=0
TOTAL_LINES=0
TOTAL_FILES=0

printf "%-35s %8s %8s %10s\n" "File" "Lines" "Words" "Bytes"
printf "%-35s %8s %8s %10s\n" "---" "---" "---" "---"

for file in $(find . -name "*.md" -type f | sort); do
    if [ -f "$file" ]; then
        LINES=$(wc -l < "$file")
        WORDS=$(wc -w < "$file")
        BYTES=$(wc -c < "$file")
        
        printf "%-35s %8d %8d %10d\n" "$file" "$LINES" "$WORDS" "$BYTES"
        
        TOTAL_BYTES=$((TOTAL_BYTES + BYTES))
        TOTAL_LINES=$((TOTAL_LINES + LINES))
        ((TOTAL_FILES++))
    fi
done

printf "%-35s %8s %8s %10s\n" "---" "---" "---" "---"
printf "%-35s %8d %8s %10d\n" "TOTAL ($TOTAL_FILES files)" "$TOTAL_LINES" "" "$TOTAL_BYTES"

echo ""

# ============================================
# TOKEN ESTIMATION
# ============================================
echo "━━━ TOKEN ESTIMATE ━━━"

# Rough estimation: ~4 characters per token for English text
# Markdown/code tends to be less efficient, ~3 chars per token
CHARS=$TOTAL_BYTES
TOKENS_LOW=$((CHARS / 5))
TOKENS_HIGH=$((CHARS / 3))
TOKENS_MID=$(((TOKENS_LOW + TOKENS_HIGH) / 2))

echo "Estimated tokens: $TOKENS_LOW - $TOKENS_HIGH (avg: ~$TOKENS_MID)"
echo ""

# Context window analysis
echo "Context window usage (if fully loaded):"
printf "  %-20s %s\n" "GPT-4 (8k):" "$(echo "scale=1; $TOKENS_MID * 100 / 8000" | bc)%"
printf "  %-20s %s\n" "GPT-4-32k:" "$(echo "scale=1; $TOKENS_MID * 100 / 32000" | bc)%"
printf "  %-20s %s\n" "Claude (100k):" "$(echo "scale=1; $TOKENS_MID * 100 / 100000" | bc)%"
printf "  %-20s %s\n" "Claude (200k):" "$(echo "scale=1; $TOKENS_MID * 100 / 200000" | bc)%"

echo ""

# ============================================
# SIZE RECOMMENDATIONS
# ============================================
echo "━━━ RECOMMENDATIONS ━━━"

if [ $TOKENS_MID -lt 2000 ]; then
    echo -e "${GREEN}✓${NC} Excellent size - loads quickly, minimal context impact"
elif [ $TOKENS_MID -lt 5000 ]; then
    echo -e "${GREEN}✓${NC} Good size - reasonable for most use cases"
elif [ $TOKENS_MID -lt 10000 ]; then
    echo -e "${YELLOW}⚠${NC} Moderate size - consider splitting into multiple files"
    echo "  Tip: Load only relevant sections instead of entire skill"
elif [ $TOKENS_MID -lt 20000 ]; then
    echo -e "${YELLOW}⚠${NC} Large skill - may impact context significantly"
    echo "  Recommendations:"
    echo "  • Split into focused sub-files"
    echo "  • Create a lightweight SKILL.md with references"
    echo "  • Load sections on-demand"
else
    echo -e "${RED}✗${NC} Very large skill - will consume significant context"
    echo "  Strongly recommend restructuring:"
    echo "  • Split into multiple independent skills"
    echo "  • Create summary + detailed reference structure"
    echo "  • Consider if all content is necessary"
fi

echo ""

# ============================================
# STRUCTURE ANALYSIS
# ============================================
echo "━━━ STRUCTURE ━━━"

# Count sections (## headings)
if [ -f "SKILL.md" ]; then
    SECTIONS=$(grep -c "^## " SKILL.md 2>/dev/null || echo 0)
    echo "SKILL.md sections: $SECTIONS"
    
    if [ $SECTIONS -gt 10 ]; then
        echo -e "${YELLOW}⚠${NC} Many sections - consider restructuring or splitting"
    fi
fi

# Check for large code blocks
LARGE_CODE_BLOCKS=$(grep -c '```' ./*.md 2>/dev/null | awk -F: '{sum += $2} END {print int(sum/2)}')
echo "Code blocks: ~$LARGE_CODE_BLOCKS"

# Links analysis
INTERNAL_LINKS=$(grep -ohE '\[.*\]\([^)]+\.md\)' ./*.md 2>/dev/null | wc -l)
EXTERNAL_LINKS=$(grep -ohE '\[.*\]\(https?://[^)]+\)' ./*.md 2>/dev/null | wc -l)
echo "Internal links: $INTERNAL_LINKS"
echo "External links: $EXTERNAL_LINKS"

echo ""

# ============================================
# PER-FILE BREAKDOWN
# ============================================
echo "━━━ LARGEST FILES ━━━"

find . -name "*.md" -type f -exec wc -c {} \; | sort -rn | head -5 | while read bytes file; do
    tokens=$((bytes / 4))
    printf "%6d tokens  %s\n" "$tokens" "$file"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
