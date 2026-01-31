#!/bin/bash
#
# Link Validator
# Check all internal and external links in skill files
#
# Usage: ./validate-links.sh [skill-directory] [--external]
#   --external: Also validate external URLs (slower, requires internet)
#

SKILL_DIR="${1:-.}"
CHECK_EXTERNAL=false
[[ "$*" == *"--external"* ]] && CHECK_EXTERNAL=true

cd "$SKILL_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

echo ""
echo -e "${BLUE}🔗 Validating links:${NC} $(basename "$(pwd)")"
echo "   External checks: $($CHECK_EXTERNAL && echo "enabled" || echo "disabled")"
echo ""

# ============================================
# INTERNAL LINKS
# ============================================
echo "━━━ INTERNAL LINKS ━━━"

for file in $(find . -name "*.md" -type f); do
    # Extract markdown links to local files: [text](path.md) or [text](./path.md)
    links=$(grep -oE '\[.*\]\(\.?/?[^)]+\.md\)' "$file" 2>/dev/null | grep -oE '\(\.?/?[^)]+\.md\)' | tr -d '()')
    
    for link in $links; do
        # Resolve relative path
        dir=$(dirname "$file")
        target="$dir/$link"
        
        # Normalize path
        target=$(realpath -m "$target" 2>/dev/null || echo "$target")
        
        if [ ! -f "$target" ]; then
            echo -e "${RED}✗${NC} Broken: $file → $link"
            ((ERRORS++))
        else
            echo -e "${GREEN}✓${NC} OK: $file → $link"
        fi
    done
done

[ $ERRORS -eq 0 ] && echo -e "${GREEN}✓${NC} All internal links valid"
echo ""

# ============================================
# ANCHOR LINKS
# ============================================
echo "━━━ ANCHOR LINKS ━━━"

for file in $(find . -name "*.md" -type f); do
    # Extract anchor links: [text](#anchor)
    anchors=$(grep -oE '\[.*\]\(#[^)]+\)' "$file" 2>/dev/null | grep -oE '#[^)]+' | tr -d '#')
    
    for anchor in $anchors; do
        # Check if heading exists (simplified: look for ## Anchor or similar)
        # Convert anchor to heading format (kebab-case to words)
        heading_pattern=$(echo "$anchor" | tr '-' ' ')
        
        if ! grep -qi "^#.*$heading_pattern" "$file" 2>/dev/null; then
            echo -e "${YELLOW}⚠${NC} Possibly broken anchor: $file → #$anchor"
            ((WARNINGS++))
        fi
    done
done

[ $WARNINGS -eq 0 ] && echo -e "${GREEN}✓${NC} Anchor links look OK (basic check)"
echo ""

# ============================================
# EXTERNAL LINKS
# ============================================
echo "━━━ EXTERNAL LINKS ━━━"

# Collect all external URLs
URLS=$(grep -ohE 'https?://[^)>\s"]+' ./*.md 2>/dev/null | sort -u)
URL_COUNT=$(echo "$URLS" | grep -c "http" || echo 0)

echo "Found $URL_COUNT unique external URLs"

if $CHECK_EXTERNAL; then
    echo "Checking external URLs (this may take a moment)..."
    echo ""
    
    for url in $URLS; do
        # Clean URL (remove trailing punctuation)
        url=$(echo "$url" | sed 's/[.,;:!?]$//')
        
        # Skip obviously dynamic URLs
        if [[ "$url" == *"example.com"* ]] || [[ "$url" == *"localhost"* ]]; then
            echo -e "${YELLOW}⊘${NC} Skipped (example): $url"
            continue
        fi
        
        # Check URL with timeout
        HTTP_CODE=$(curl -o /dev/null -s -w "%{http_code}" --max-time 10 -L "$url" 2>/dev/null || echo "000")
        
        if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 400 ]; then
            echo -e "${GREEN}✓${NC} $HTTP_CODE: $url"
        elif [ "$HTTP_CODE" == "000" ]; then
            echo -e "${RED}✗${NC} Timeout/Error: $url"
            ((ERRORS++))
        else
            echo -e "${RED}✗${NC} $HTTP_CODE: $url"
            ((ERRORS++))
        fi
    done
else
    echo "Use --external flag to validate external URLs"
    echo ""
    echo "External URLs found:"
    echo "$URLS" | head -10
    [ $URL_COUNT -gt 10 ] && echo "  ... and $((URL_COUNT - 10)) more"
fi

echo ""

# ============================================
# IMAGE REFERENCES
# ============================================
echo "━━━ IMAGE REFERENCES ━━━"

IMAGES=$(grep -ohE '!\[.*\]\([^)]+\)' ./*.md 2>/dev/null | grep -oE '\([^)]+\)' | tr -d '()')
IMG_COUNT=$(echo "$IMAGES" | grep -c "." 2>/dev/null || echo 0)

if [ $IMG_COUNT -gt 0 ]; then
    echo "Found $IMG_COUNT image references"
    
    for img in $IMAGES; do
        if [[ "$img" == http* ]]; then
            echo -e "${BLUE}↗${NC} External image: $img"
        elif [ -f "$img" ]; then
            echo -e "${GREEN}✓${NC} Local image: $img"
        else
            echo -e "${RED}✗${NC} Missing image: $img"
            ((ERRORS++))
        fi
    done
else
    echo "No image references found"
fi

echo ""

# ============================================
# SUMMARY
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}✗ Found $ERRORS broken link(s)${NC}"
    [ $WARNINGS -gt 0 ] && echo -e "${YELLOW}  Plus $WARNINGS warning(s)${NC}"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s), no errors${NC}"
    exit 0
else
    echo -e "${GREEN}✓ All links valid!${NC}"
    exit 0
fi
