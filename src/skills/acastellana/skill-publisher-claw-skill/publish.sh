#!/bin/bash
#
# Skill Publish Script
# One command to audit, fix, commit, and push a skill
#
# Usage: ./publish.sh [skill-directory] [--force]
#   --force: Skip confirmation prompts
#

set -e

SKILL_DIR="${1:-.}"
FORCE=false
[[ "$*" == *"--force"* ]] && FORCE=true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cd "$SKILL_DIR"
SKILL_NAME=$(basename "$(pwd)")

echo ""
echo -e "${BLUE}📦 Publishing skill:${NC} $SKILL_NAME"
echo "   Path: $(pwd)"
echo ""

# ============================================
# STEP 1: Run audit
# ============================================
echo "━━━ STEP 1: Audit ━━━"
if ! "$SCRIPT_DIR/audit.sh" . 2>/dev/null; then
    echo ""
    echo -e "${RED}Audit failed!${NC}"
    
    if $FORCE; then
        echo "Force mode: continuing anyway..."
    else
        read -p "Run fix.sh to attempt auto-fixes? [Y/n] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
            "$SCRIPT_DIR/fix.sh" . --auto
            echo ""
            echo "Re-running audit..."
            if ! "$SCRIPT_DIR/audit.sh" . 2>/dev/null; then
                echo -e "${RED}Audit still failing after fixes.${NC}"
                echo "Please fix remaining issues manually."
                exit 1
            fi
        else
            echo "Please fix issues before publishing."
            exit 1
        fi
    fi
fi
echo ""

# ============================================
# STEP 2: Check git status
# ============================================
echo "━━━ STEP 2: Git Status ━━━"

if [ ! -d ".git" ]; then
    echo "Initializing git repository..."
    git init -q
    git branch -m main 2>/dev/null || true
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "Uncommitted changes found:"
    git status --short
    echo ""
    
    if $FORCE; then
        COMMIT_MSG="Update skill content"
    else
        read -p "Commit message: " COMMIT_MSG
        [ -z "$COMMIT_MSG" ] && COMMIT_MSG="Update skill content"
    fi
    
    git add -A
    git commit -m "$COMMIT_MSG"
    echo -e "${GREEN}✓${NC} Changes committed"
else
    echo -e "${GREEN}✓${NC} Working tree clean"
fi
echo ""

# ============================================
# STEP 3: Check remote
# ============================================
echo "━━━ STEP 3: Remote Repository ━━━"

REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")

if [ -z "$REMOTE_URL" ]; then
    echo "No remote configured."
    
    if $FORCE; then
        echo "Force mode: skipping remote setup (push manually)"
    else
        read -p "Create GitHub repository? [Y/n] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
            # Check if gh is available
            if ! command -v gh &> /dev/null; then
                echo -e "${RED}GitHub CLI (gh) not installed.${NC}"
                echo "Install it or create repo manually: https://cli.github.com"
                exit 1
            fi
            
            # Check auth
            if ! gh auth status &>/dev/null; then
                echo "Please authenticate: gh auth login"
                exit 1
            fi
            
            read -p "Repository name (default: $SKILL_NAME): " REPO_NAME
            [ -z "$REPO_NAME" ] && REPO_NAME="$SKILL_NAME"
            
            read -p "Description: " REPO_DESC
            [ -z "$REPO_DESC" ] && REPO_DESC="AI assistant skill: $SKILL_NAME"
            
            read -p "Public or private? [public/private] " VISIBILITY
            [[ "$VISIBILITY" != "private" ]] && VISIBILITY="public"
            
            echo "Creating repository..."
            gh repo create "$REPO_NAME" --"$VISIBILITY" --description "$REPO_DESC" --source=. --push
            echo -e "${GREEN}✓${NC} Repository created and pushed"
        else
            echo "Skipping remote setup."
        fi
    fi
else
    echo "Remote: $REMOTE_URL"
    echo -e "${GREEN}✓${NC} Remote configured"
fi
echo ""

# ============================================
# STEP 4: Push
# ============================================
echo "━━━ STEP 4: Push ━━━"

if [ -n "$REMOTE_URL" ]; then
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    
    # Check if we need to push
    LOCAL=$(git rev-parse "$BRANCH" 2>/dev/null || echo "")
    REMOTE=$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo "")
    
    if [ "$LOCAL" != "$REMOTE" ]; then
        if $FORCE; then
            git push -u origin "$BRANCH"
        else
            read -p "Push to origin/$BRANCH? [Y/n] " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
                git push -u origin "$BRANCH"
            else
                echo "Skipping push."
            fi
        fi
        echo -e "${GREEN}✓${NC} Pushed to remote"
    else
        echo -e "${GREEN}✓${NC} Already up to date"
    fi
else
    echo "No remote configured, skipping push."
fi
echo ""

# ============================================
# STEP 5: Summary
# ============================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ Publish complete!${NC}"
echo ""

if [ -n "$REMOTE_URL" ]; then
    # Extract repo URL for display
    REPO_URL=$(echo "$REMOTE_URL" | sed 's/\.git$//' | sed 's|git@github.com:|https://github.com/|')
    echo "Repository: $REPO_URL"
fi

echo ""
echo "Optional next steps:"
echo "  • Add to ClawdHub: clawdhub publish ."
echo "  • Add to your AGENTS.md skill list"
echo "  • Share on Discord/community"
