#!/bin/bash
#
# Skill Scaffold Script
# Create a new skill from templates with proper structure
#
# Usage: ./scaffold.sh <skill-name> [target-directory]
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ -z "$1" ]; then
    echo "Usage: $0 <skill-name> [target-directory]"
    echo ""
    echo "Examples:"
    echo "  $0 my-awesome-skill"
    echo "  $0 my-awesome-skill ~/projects/skills/"
    exit 1
fi

SKILL_NAME="$1"
TARGET_DIR="${2:-.}"
SKILL_DIR="$TARGET_DIR/$SKILL_NAME"

# Validate skill name
if [[ ! "$SKILL_NAME" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]]; then
    echo -e "${RED}Error:${NC} Skill name must be lowercase, alphanumeric with hyphens only"
    echo "  Valid: my-skill, skill123, awesome-tool"
    echo "  Invalid: My_Skill, skill.name, -skill-"
    exit 1
fi

if [ -d "$SKILL_DIR" ]; then
    echo -e "${RED}Error:${NC} Directory already exists: $SKILL_DIR"
    exit 1
fi

echo ""
echo -e "${BLUE}🔨 Scaffolding new skill:${NC} $SKILL_NAME"
echo "   Location: $SKILL_DIR"
echo ""

# Create directory
mkdir -p "$SKILL_DIR"
cd "$SKILL_DIR"

# Get author info
AUTHOR=$(git config user.name 2>/dev/null || echo "")
YEAR=$(date +%Y)

# Create SKILL.md
echo -e "${GREEN}→${NC} Creating SKILL.md"
SKILL_TITLE=$(echo "$SKILL_NAME" | sed 's/-/ /g' | sed 's/\b\(.\)/\u\1/g')
cat > SKILL.md << EOF
# $SKILL_TITLE

[One-line description of what this skill provides]

## When to Use

- [Specific trigger condition 1]
- [Specific trigger condition 2]
- [Keywords that should activate this skill]

## Quick Reference

[Most essential information - the stuff you need 80% of the time]

| Command/Concept | Description |
|-----------------|-------------|
| \`example\` | [What it does] |

## Overview

[2-3 paragraphs explaining the skill in more detail]

## [Main Section]

[Detailed content organized logically]

## Examples

### Example 1: [Description]

\`\`\`bash
# [Complete, working example]
\`\`\`

## Troubleshooting

| Issue | Solution |
|-------|----------|
| [Common problem] | [How to fix] |

## Links

- [Official Docs](https://example.com)
EOF

# Create README.md
echo -e "${GREEN}→${NC} Creating README.md"
cat > README.md << EOF
# $SKILL_TITLE

[Brief description - 1-2 sentences]

## What's Inside

| File | Description |
|------|-------------|
| \`SKILL.md\` | Main skill content and quick reference |

## Quick Summary

[Core value proposition - what can someone do with this skill?]

## Usage

This skill is designed for AI assistants. Load it when:
- [Trigger condition 1]
- [Trigger condition 2]

## Requirements

- [Any dependencies or prerequisites]

## License

MIT License - see [LICENSE](LICENSE) for details.
EOF

# Create LICENSE
echo -e "${GREEN}→${NC} Creating LICENSE"
cat > LICENSE << EOF
MIT License

Copyright (c) $YEAR $AUTHOR

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF

# Create .gitignore
echo -e "${GREEN}→${NC} Creating .gitignore"
cat > .gitignore << 'EOF'
# OS files
.DS_Store
Thumbs.db

# Editor files
*.swp
*.swo
*~
.idea/
.vscode/

# Temporary files
*.tmp
*.bak
*.log

# Test artifacts
test-output/
EOF

# Initialize git
echo -e "${GREEN}→${NC} Initializing git repository"
git init -q
git branch -m main 2>/dev/null || true
git add -A
git commit -q -m "Initial scaffold for $SKILL_NAME"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✓ Skill scaffolded successfully!${NC}"
echo ""
echo "Next steps:"
echo "  1. cd $SKILL_DIR"
echo "  2. Edit SKILL.md with your content"
echo "  3. Edit README.md with description"
echo "  4. Run: $SCRIPT_DIR/audit.sh ."
echo "  5. Commit and push!"
echo ""
echo "Structure created:"
echo "  $SKILL_NAME/"
echo "  ├── SKILL.md      ← Main content (edit this)"
echo "  ├── README.md     ← GitHub readme (edit this)"
echo "  ├── LICENSE       ← MIT license"
echo "  └── .gitignore"
