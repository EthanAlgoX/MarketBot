#!/bin/bash
#
# Skill Quality Score
# Rate a skill on multiple dimensions (0-100)
#
# Usage: ./score.sh [skill-directory]
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
echo -e "${BLUE}📊 Skill Quality Score${NC}"
echo "   $(basename "$(pwd)")"
echo ""

TOTAL_SCORE=0
MAX_SCORE=0

score_item() {
    local name="$1"
    local points="$2"
    local max="$3"
    local reason="$4"
    
    TOTAL_SCORE=$((TOTAL_SCORE + points))
    MAX_SCORE=$((MAX_SCORE + max))
    
    local pct=$((points * 100 / max))
    
    if [ $pct -ge 80 ]; then
        COLOR=$GREEN
    elif [ $pct -ge 50 ]; then
        COLOR=$YELLOW
    else
        COLOR=$RED
    fi
    
    printf "  %-25s ${COLOR}%2d/%2d${NC}  %s\n" "$name" "$points" "$max" "$reason"
}

# ============================================
# STRUCTURE (20 points)
# ============================================
echo "━━━ STRUCTURE ━━━"

# SKILL.md exists (5)
if [ -f "SKILL.md" ]; then
    score_item "SKILL.md" 5 5 "✓ exists"
else
    score_item "SKILL.md" 0 5 "✗ missing (required)"
fi

# README.md exists (3)
if [ -f "README.md" ]; then
    score_item "README.md" 3 3 "✓ exists"
else
    score_item "README.md" 0 3 "✗ missing"
fi

# LICENSE exists (2)
if [ -f "LICENSE" ] || [ -f "LICENSE.md" ] || [ -f "LICENSE.txt" ]; then
    score_item "LICENSE" 2 2 "✓ exists"
else
    score_item "LICENSE" 0 2 "✗ missing"
fi

# .gitignore exists (2)
if [ -f ".gitignore" ]; then
    score_item ".gitignore" 2 2 "✓ exists"
else
    score_item ".gitignore" 0 2 "✗ missing"
fi

# Git repo (3)
if [ -d ".git" ]; then
    score_item "Git repository" 3 3 "✓ initialized"
else
    score_item "Git repository" 0 3 "✗ not a repo"
fi

# Logical file count (5)
FILE_COUNT=$(find . -name "*.md" -type f | wc -l)
if [ $FILE_COUNT -ge 1 ] && [ $FILE_COUNT -le 10 ]; then
    score_item "File organization" 5 5 "✓ $FILE_COUNT files (good)"
elif [ $FILE_COUNT -le 20 ]; then
    score_item "File organization" 3 5 "○ $FILE_COUNT files (consider splitting)"
else
    score_item "File organization" 1 5 "✗ $FILE_COUNT files (too many)"
fi

echo ""

# ============================================
# DOCUMENTATION (30 points)
# ============================================
echo "━━━ DOCUMENTATION ━━━"

# README quality check (5)
if [ -f "README.md" ]; then
    README_ISSUES=0
    
    # Check for AI buzzwords
    AI_BUZZWORDS=$(grep -ciE "(comprehensive solution|seamless|robust|scalable|leverage|cutting-edge|revolutionary|game-changing|ever-evolving landscape|serves as a testament)" README.md 2>/dev/null || echo 0)
    [ "$AI_BUZZWORDS" -gt 0 ] && README_ISSUES=$((README_ISSUES + AI_BUZZWORDS))
    
    # Check first line isn't generic welcome
    FIRST_LINE=$(head -3 README.md | grep -ciE "^(welcome|introduction|getting started|about)" 2>/dev/null || echo 0)
    [ "$FIRST_LINE" -gt 0 ] && README_ISSUES=$((README_ISSUES + 2))
    
    # Check for emoji-decorated headers
    EMOJI_HEADERS=$(grep -cE "^#+.*[🚀💡✨🎯🔥⭐]" README.md 2>/dev/null || echo 0)
    [ "$EMOJI_HEADERS" -gt 2 ] && README_ISSUES=$((README_ISSUES + 1))
    
    if [ $README_ISSUES -eq 0 ]; then
        score_item "README quality" 5 5 "✓ clear, human-sounding"
    elif [ $README_ISSUES -le 2 ]; then
        score_item "README quality" 3 5 "○ minor issues ($README_ISSUES)"
    else
        score_item "README quality" 1 5 "✗ AI-sounding ($README_ISSUES issues)"
    fi
else
    score_item "README quality" 0 5 "✗ no README"
fi

# When to Use section (8)
if [ -f "SKILL.md" ] && grep -qi "when to use\|## when" SKILL.md; then
    TRIGGERS=$(grep -A 10 -i "when to use\|## when" SKILL.md | grep "^-" | wc -l)
    if [ $TRIGGERS -ge 3 ]; then
        score_item "When to Use" 8 8 "✓ $TRIGGERS triggers defined"
    elif [ $TRIGGERS -ge 1 ]; then
        score_item "When to Use" 5 8 "○ $TRIGGERS triggers (add more)"
    else
        score_item "When to Use" 3 8 "○ section exists but empty"
    fi
else
    score_item "When to Use" 0 8 "✗ missing section"
fi

# Quick Reference (5)
if [ -f "SKILL.md" ] && grep -qiE "quick ref|## ref|## quick" SKILL.md; then
    score_item "Quick Reference" 5 5 "✓ exists"
else
    score_item "Quick Reference" 2 5 "○ consider adding"
fi

# Examples (7)
EXAMPLES=$(grep -c '```' ./*.md 2>/dev/null | awk -F: '{sum += $2} END {print int(sum/2)}')
if [ $EXAMPLES -ge 5 ]; then
    score_item "Examples" 7 7 "✓ $EXAMPLES code examples"
elif [ $EXAMPLES -ge 2 ]; then
    score_item "Examples" 5 7 "○ $EXAMPLES examples (add more)"
elif [ $EXAMPLES -ge 1 ]; then
    score_item "Examples" 3 7 "○ $EXAMPLES example (add more)"
else
    score_item "Examples" 0 7 "✗ no examples"
fi

# Links (5)
EXT_LINKS=$(grep -ohE '\[.*\]\(https?://[^)]+\)' ./*.md 2>/dev/null | wc -l)
if [ $EXT_LINKS -ge 3 ]; then
    score_item "External Links" 5 5 "✓ $EXT_LINKS links"
elif [ $EXT_LINKS -ge 1 ]; then
    score_item "External Links" 3 5 "○ $EXT_LINKS links"
else
    score_item "External Links" 1 5 "○ no external links"
fi

echo ""

# ============================================
# QUALITY (25 points)
# ============================================
echo "━━━ QUALITY ━━━"

# No TODOs (5) - exclude templates dir and grep/code examples
TODO_COUNT=$(grep -rniE "(TODO|FIXME|XXX)" . --include="*.md" --exclude-dir=templates 2>/dev/null | grep -v "grep.*TODO\|echo.*TODO\|\"TODO" | wc -l)
if [ $TODO_COUNT -eq 0 ]; then
    score_item "No TODOs" 5 5 "✓ clean"
elif [ $TODO_COUNT -le 3 ]; then
    score_item "No TODOs" 3 5 "○ $TODO_COUNT items"
else
    score_item "No TODOs" 0 5 "✗ $TODO_COUNT items"
fi

# No placeholder text (5) - exclude templates directory
if ! grep -rniE "(lorem ipsum|TBD|placeholder|CHANGEME)" . --include="*.md" --exclude-dir=templates 2>/dev/null > /dev/null; then
    score_item "No placeholders" 5 5 "✓ clean"
else
    score_item "No placeholders" 0 5 "✗ found"
fi

# Consistent formatting (5)
UNMARKED_BLOCKS=$(grep -c '^```$' ./*.md 2>/dev/null | awk -F: '{sum += $2} END {print sum}')
if [ "$UNMARKED_BLOCKS" -eq 0 ] || [ -z "$UNMARKED_BLOCKS" ]; then
    score_item "Code block langs" 5 5 "✓ all marked"
else
    score_item "Code block langs" 2 5 "○ $UNMARKED_BLOCKS unmarked"
fi

# Size efficiency (10)
TOTAL_BYTES=$(find . -name "*.md" -type f -exec cat {} \; 2>/dev/null | wc -c)
TOKENS_EST=$((TOTAL_BYTES / 4))
if [ $TOKENS_EST -lt 5000 ]; then
    score_item "Size efficiency" 10 10 "✓ ~$TOKENS_EST tokens (excellent)"
elif [ $TOKENS_EST -lt 10000 ]; then
    score_item "Size efficiency" 8 10 "✓ ~$TOKENS_EST tokens (good)"
elif [ $TOKENS_EST -lt 20000 ]; then
    score_item "Size efficiency" 5 10 "○ ~$TOKENS_EST tokens (large)"
else
    score_item "Size efficiency" 2 10 "✗ ~$TOKENS_EST tokens (too large)"
fi

echo ""

# ============================================
# SECURITY (20 points)
# ============================================
echo "━━━ SECURITY ━━━"

# No secrets (10)
if ! grep -rniE "(api[_-]?key|secret|password)\s*[=:]\s*['\"]?[a-zA-Z0-9]{16,}" . --include="*.md" --exclude-dir=templates 2>/dev/null | grep -v "example\|sample" > /dev/null; then
    score_item "No secrets" 10 10 "✓ clean"
else
    score_item "No secrets" 0 10 "✗ potential secrets found"
fi

# No hardcoded paths (5)
if ! grep -rniE "\/home\/[a-z]+|\/Users\/[a-zA-Z]+" . --include="*.md" --exclude-dir=templates 2>/dev/null > /dev/null; then
    score_item "No hardcoded paths" 5 5 "✓ portable"
else
    score_item "No hardcoded paths" 0 5 "✗ hardcoded paths found"
fi

# No personal data (5)
if ! grep -rniE "@(gmail|yahoo|hotmail|proton)\." . --include="*.md" --exclude-dir=templates 2>/dev/null > /dev/null; then
    score_item "No personal emails" 5 5 "✓ clean"
else
    score_item "No personal emails" 2 5 "○ personal emails found"
fi

echo ""

# ============================================
# MAINTENANCE (10 points)
# ============================================
echo "━━━ MAINTENANCE ━━━"

# Git history (5)
if [ -d ".git" ]; then
    COMMITS=$(git rev-list --count HEAD 2>/dev/null || echo 0)
    if [ $COMMITS -ge 5 ]; then
        score_item "Git history" 5 5 "✓ $COMMITS commits"
    elif [ $COMMITS -ge 2 ]; then
        score_item "Git history" 3 5 "○ $COMMITS commits"
    else
        score_item "Git history" 1 5 "○ $COMMITS commits"
    fi
else
    score_item "Git history" 0 5 "✗ no git"
fi

# Has tags/versions (5)
if [ -d ".git" ]; then
    TAGS=$(git tag -l 2>/dev/null | wc -l)
    if [ $TAGS -ge 1 ]; then
        score_item "Versioning" 5 5 "✓ $TAGS version tags"
    else
        score_item "Versioning" 2 5 "○ no version tags"
    fi
else
    score_item "Versioning" 0 5 "✗ no git"
fi

echo ""

# ============================================
# FINAL SCORE
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
FINAL_PCT=$((TOTAL_SCORE * 100 / MAX_SCORE))

if [ $FINAL_PCT -ge 90 ]; then
    GRADE="A"
    GRADE_COLOR=$GREEN
    VERDICT="Excellent! Ready for publication."
elif [ $FINAL_PCT -ge 80 ]; then
    GRADE="B"
    GRADE_COLOR=$GREEN
    VERDICT="Good quality. Minor improvements possible."
elif [ $FINAL_PCT -ge 70 ]; then
    GRADE="C"
    GRADE_COLOR=$YELLOW
    VERDICT="Acceptable. Consider improvements before publishing."
elif [ $FINAL_PCT -ge 60 ]; then
    GRADE="D"
    GRADE_COLOR=$YELLOW
    VERDICT="Needs work. Address issues before publishing."
else
    GRADE="F"
    GRADE_COLOR=$RED
    VERDICT="Not ready. Significant improvements needed."
fi

echo ""
printf "  ${GRADE_COLOR}SCORE: %d/%d (%d%%) - Grade: %s${NC}\n" "$TOTAL_SCORE" "$MAX_SCORE" "$FINAL_PCT" "$GRADE"
echo ""
echo "  $VERDICT"
echo ""
