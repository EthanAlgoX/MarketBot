#!/bin/bash
#
# Skill Fix Script
# Auto-fix common issues found by audit.sh
#
# Usage: ./fix.sh [skill-directory] [--auto]
#   --auto: Non-interactive mode, apply all safe fixes
#

set -e

SKILL_DIR="${1:-.}"
AUTO_MODE=false
[[ "$2" == "--auto" ]] && AUTO_MODE=true

cd "$SKILL_DIR"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

FIXES=0

info() { echo -e "${BLUE}→${NC} $1"; }
fixed() { echo -e "${GREEN}✓${NC} Fixed: $1"; ((FIXES++)); }
skip() { echo -e "${YELLOW}⊘${NC} Skipped: $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }

ask() {
    if $AUTO_MODE; then
        return 0
    fi
    read -p "$1 [Y/n] " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]
}

ask_choice() {
    if $AUTO_MODE; then
        echo "1"
        return
    fi
    local prompt="$1"
    shift
    local i=1
    for opt in "$@"; do
        echo "  [$i] $opt"
        ((i++))
    done
    read -p "$prompt " -n 1 -r
    echo
    echo "$REPLY"
}

echo ""
echo "🔧 Fixing skill: $(basename "$(pwd)")"
echo "   Path: $(pwd)"
echo "   Mode: $($AUTO_MODE && echo "automatic" || echo "interactive")"
echo ""

# ============================================
# 1. MISSING FILES
# ============================================
info "Checking required files..."

# README.md
if [ ! -f "README.md" ]; then
    if ask "Create README.md from template?"; then
        SKILL_NAME=$(basename "$(pwd)")
        sed "s/Skill Name/$SKILL_NAME/g" "$SCRIPT_DIR/templates/README.template.md" > README.md
        fixed "Created README.md"
    else
        skip "README.md"
    fi
fi

# LICENSE
if [ ! -f "LICENSE" ] && [ ! -f "LICENSE.md" ] && [ ! -f "LICENSE.txt" ]; then
    if ask "Create LICENSE (MIT)?"; then
        YEAR=$(date +%Y)
        AUTHOR=$(git config user.name 2>/dev/null || echo "[AUTHOR]")
        sed -e "s/\[YEAR\]/$YEAR/g" -e "s/\[AUTHOR\]/$AUTHOR/g" "$SCRIPT_DIR/templates/LICENSE.template" > LICENSE
        fixed "Created LICENSE"
    else
        skip "LICENSE"
    fi
fi

# .gitignore
if [ ! -f ".gitignore" ]; then
    if ask "Create .gitignore?"; then
        cp "$SCRIPT_DIR/templates/gitignore.template" .gitignore
        fixed "Created .gitignore"
    else
        skip ".gitignore"
    fi
fi

# SKILL.md
if [ ! -f "SKILL.md" ]; then
    if ask "Create SKILL.md from template?"; then
        SKILL_NAME=$(basename "$(pwd)")
        sed "s/Skill Name/$SKILL_NAME/g" "$SCRIPT_DIR/templates/SKILL.template.md" > SKILL.md
        fixed "Created SKILL.md (needs editing)"
        warn "Remember to fill in SKILL.md content!"
    else
        skip "SKILL.md"
    fi
fi

# Git repo
if [ ! -d ".git" ]; then
    if ask "Initialize git repository?"; then
        git init -q
        git branch -m main 2>/dev/null || true
        fixed "Initialized git repo"
    else
        skip "git init"
    fi
fi

echo ""

# ============================================
# 2. HARDCODED PATHS
# ============================================
info "Checking for hardcoded paths..."

fix_paths() {
    local pattern="$1"
    local files=$(grep -rl "$pattern" . --include="*.md" 2>/dev/null || true)
    
    for file in $files; do
        if [ -n "$file" ]; then
            matches=$(grep -n "$pattern" "$file" 2>/dev/null || true)
            while IFS= read -r match; do
                [ -z "$match" ] && continue
                line_num=$(echo "$match" | cut -d: -f1)
                line_content=$(echo "$match" | cut -d: -f2-)
                
                echo ""
                echo "  File: $file:$line_num"
                echo "  Content: $line_content"
                
                if $AUTO_MODE; then
                    # In auto mode, replace with $HOME
                    sed -i "${line_num}s|$pattern[^/]*|\\$HOME|g" "$file"
                    fixed "Replaced hardcoded path with \$HOME"
                else
                    choice=$(ask_choice "Choose fix:" "Replace with \$HOME" "Make relative" "Skip")
                    case $choice in
                        1)
                            sed -i "${line_num}s|$pattern[^/]*|\\$HOME|g" "$file"
                            fixed "Replaced with \$HOME"
                            ;;
                        2)
                            # Extract what comes after the home dir
                            remainder=$(echo "$line_content" | grep -oE "$pattern[^/]*/\K.*" || echo "")
                            if [ -n "$remainder" ]; then
                                sed -i "${line_num}s|$pattern[^/]*/|./|g" "$file"
                                fixed "Made relative"
                            else
                                skip "Couldn't make relative"
                            fi
                            ;;
                        *)
                            skip "Path fix"
                            ;;
                    esac
                fi
            done <<< "$matches"
        fi
    done
}

fix_paths "/home/"
fix_paths "/Users/"

echo ""

# ============================================
# 3. PERSONAL EMAILS
# ============================================
info "Checking for personal emails..."

for file in $(grep -rlE "[a-zA-Z0-9._%+-]+@(gmail|yahoo|hotmail|proton|outlook)\." . --include="*.md" 2>/dev/null || true); do
    if [ -n "$file" ]; then
        matches=$(grep -nE "[a-zA-Z0-9._%+-]+@(gmail|yahoo|hotmail|proton|outlook)\." "$file" 2>/dev/null || true)
        while IFS= read -r match; do
            [ -z "$match" ] && continue
            line_num=$(echo "$match" | cut -d: -f1)
            email=$(echo "$match" | grep -oE "[a-zA-Z0-9._%+-]+@(gmail|yahoo|hotmail|proton|outlook)\.[a-z]+" || true)
            
            if [ -n "$email" ]; then
                echo "  Found: $email in $file:$line_num"
                if ask "Replace with user@example.com?"; then
                    sed -i "s|$email|user@example.com|g" "$file"
                    fixed "Replaced email"
                else
                    skip "Email"
                fi
            fi
        done <<< "$matches"
    fi
done

echo ""

# ============================================
# 4. TRAILING WHITESPACE
# ============================================
info "Fixing trailing whitespace..."

for file in ./*.md; do
    if [ -f "$file" ]; then
        if grep -q '[[:space:]]$' "$file" 2>/dev/null; then
            sed -i 's/[[:space:]]*$//' "$file"
            fixed "Removed trailing whitespace from $(basename "$file")"
        fi
    fi
done

echo ""

# ============================================
# 5. CODE BLOCKS WITHOUT LANGUAGE
# ============================================
info "Checking code blocks..."

for file in ./*.md; do
    if [ -f "$file" ]; then
        # Find ``` not followed by a language identifier
        if grep -qE '^\`\`\`$' "$file" 2>/dev/null; then
            if ask "Add 'text' language to unmarked code blocks in $(basename "$file")?"; then
                sed -i 's/^```$/```text/g' "$file"
                fixed "Added language tags to code blocks"
            else
                skip "Code block language tags"
            fi
        fi
    fi
done

echo ""

# ============================================
# 6. SKILL.md SECTIONS
# ============================================
if [ -f "SKILL.md" ]; then
    info "Checking SKILL.md structure..."
    
    if ! grep -qi "## When to Use" SKILL.md; then
        if ask "Add 'When to Use' section to SKILL.md?"; then
            # Add after first heading
            sed -i '0,/^# /{/^# /a\
\
## When to Use\
\
- [Add trigger conditions here]\
- [When should this skill be loaded?]\
}' SKILL.md
            fixed "Added 'When to Use' section"
            warn "Remember to fill in the trigger conditions!"
        else
            skip "When to Use section"
        fi
    fi
fi

echo ""

# ============================================
# 7. NORMALIZE LINE ENDINGS
# ============================================
info "Normalizing line endings..."

for file in ./*.md; do
    if [ -f "$file" ]; then
        if file "$file" | grep -q "CRLF"; then
            sed -i 's/\r$//' "$file"
            fixed "Converted CRLF to LF in $(basename "$file")"
        fi
    fi
done

echo ""

# ============================================
# SUMMARY
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FIXES -gt 0 ]; then
    echo -e "${GREEN}✓ Applied $FIXES fix(es)${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review changes: git diff"
    echo "  2. Run audit: ./audit.sh ."
    echo "  3. Commit: git add -A && git commit -m 'Apply skill-publisher fixes'"
else
    echo -e "${GREEN}✓ No fixes needed${NC}"
fi
