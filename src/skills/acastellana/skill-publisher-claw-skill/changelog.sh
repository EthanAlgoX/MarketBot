#!/bin/bash
#
# Changelog Generator
# Generate changelog from git commits
#
# Usage: ./changelog.sh [skill-directory] [--since=tag/date]
#

SKILL_DIR="${1:-.}"
SINCE=""

for arg in "$@"; do
    case $arg in
        --since=*)
            SINCE="${arg#*=}"
            ;;
    esac
done

cd "$SKILL_DIR"

if [ ! -d ".git" ]; then
    echo "Error: Not a git repository"
    exit 1
fi

BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}📝 Generating changelog${NC}"
echo ""

# Get version info
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
CURRENT_DATE=$(date +%Y-%m-%d)

if [ -n "$SINCE" ]; then
    RANGE="$SINCE..HEAD"
    echo "Changes since: $SINCE"
elif [ -n "$LATEST_TAG" ]; then
    RANGE="$LATEST_TAG..HEAD"
    echo "Changes since: $LATEST_TAG"
else
    RANGE=""
    echo "All changes (no tags found)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Generate changelog
echo "## [Unreleased] - $CURRENT_DATE"
echo ""

# Group commits by type
echo "### Added"
git log $RANGE --pretty=format:"- %s" --grep="^feat\|^add\|^new" --no-merges 2>/dev/null | head -20 || echo "_No additions_"
echo ""

echo "### Changed"
git log $RANGE --pretty=format:"- %s" --grep="^change\|^update\|^refactor\|^improve" --no-merges 2>/dev/null | head -20 || echo "_No changes_"
echo ""

echo "### Fixed"
git log $RANGE --pretty=format:"- %s" --grep="^fix\|^bug\|^patch" --no-merges 2>/dev/null | head -20 || echo "_No fixes_"
echo ""

echo "### Documentation"
git log $RANGE --pretty=format:"- %s" --grep="^doc\|^readme" --no-merges 2>/dev/null | head -20 || echo "_No doc changes_"
echo ""

# If no categorized commits, show all
CATEGORIZED=$(git log $RANGE --pretty=format:"%s" --grep="^feat\|^add\|^new\|^change\|^update\|^refactor\|^fix\|^bug\|^doc" --no-merges 2>/dev/null | wc -l)
TOTAL=$(git log $RANGE --pretty=format:"%s" --no-merges 2>/dev/null | wc -l)
UNCATEGORIZED=$((TOTAL - CATEGORIZED))

if [ $UNCATEGORIZED -gt 0 ]; then
    echo "### Other"
    git log $RANGE --pretty=format:"- %s" --no-merges 2>/dev/null | grep -v "^- feat\|^- add\|^- new\|^- change\|^- update\|^- refactor\|^- fix\|^- bug\|^- doc" | head -20
    echo ""
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Tip: Use conventional commit messages for better changelogs:"
echo "  feat: Add new feature"
echo "  fix: Fix bug"
echo "  docs: Update documentation"
echo "  refactor: Code cleanup"
echo "  chore: Maintenance task"
