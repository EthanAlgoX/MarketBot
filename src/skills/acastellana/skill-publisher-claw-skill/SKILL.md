---
name: skill-publisher-claw-skill
description: Prepare Claw skills for public release. Use when publishing skills to GitHub or ClawdHub - covers security audit, portability, documentation, git hygiene. Triggers: publish skill, release skill, audit skill, skill checklist, prepare skill for release.
---

# Skill Publisher

Prepare a skill for public release. Run through this checklist before publishing any skill to ensure it's reusable, clean, safe, and well-documented.

## When to Use

- Before pushing a skill to a public repo
- Before submitting to ClawdHub
- When reviewing someone else's skill
- Periodic audits of existing published skills

## Quick Checklist

Run through these in order. Each section has detailed guidance below.

```
[ ] 1. STRUCTURE    - Required files present, logical organization
[ ] 2. SECURITY     - No secrets, keys, PII, or sensitive data  
[ ] 3. PORTABILITY  - No hardcoded paths, works on any machine
[ ] 4. QUALITY      - Clean code, no debug artifacts
[ ] 5. DOCS         - README, SKILL.md, examples complete
[ ] 6. TESTING      - Verified it actually works
[ ] 7. GIT          - Clean history, proper .gitignore, good commits
[ ] 8. METADATA     - License, description, keywords
```

---

## 1. Structure Validation

### Required Files
```
skill-name/
├── SKILL.md          # REQUIRED - Entry point, when to use, quick reference
├── README.md         # REQUIRED - For GitHub/humans
└── [content files]   # The actual skill content
```

### SKILL.md Format
Must include:
- **Header**: Name and one-line description
- **When to Use**: Clear triggers for loading this skill
- **Quick Reference**: Most important info at a glance
- **Detailed sections**: As needed

```markdown
# Skill Name

One-line description of what this skill does.

## When to Use
- Trigger condition 1
- Trigger condition 2

## Quick Reference
[Most important info here]

## [Additional Sections]
[Detailed content]
```

### File Organization
- Group related content logically
- Use clear, descriptive filenames
- Keep files focused (single responsibility)
- Consider load order (what gets read first?)

### Anti-patterns
❌ Single massive file with everything  
❌ Cryptic filenames (`data1.md`, `stuff.md`)  
❌ Circular dependencies between files  
❌ Missing SKILL.md entry point  

---

## 2. Security Audit

### Secrets Scan
Search for and REMOVE:
```bash
# Run in skill directory
grep -rniE "(api[_-]?key|secret|password|token|bearer|auth)" . --include="*.md"
grep -rniE "([a-zA-Z0-9]{32,})" . --include="*.md"  # Long strings that might be keys
grep -rniE "(sk-|pk-|xai-|ghp_|gho_)" . --include="*.md"  # Common key prefixes
```

### Personal Data Scan
Search for and REMOVE:
```bash
grep -rniE "(@gmail|@yahoo|@hotmail|@proton)" . --include="*.md"
grep -rniE "\+?[0-9]{10,}" . --include="*.md"  # Phone numbers
grep -rniE "[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}" . --include="*.md"  # IPs
```

### Sensitive Content Check
- [ ] No internal company information
- [ ] No private URLs or endpoints  
- [ ] No employee names (unless public figures)
- [ ] No financial data
- [ ] No credentials of any kind
- [ ] No session tokens or cookies

### Example Data
If examples need realistic data, use:
- `user@example.com` for emails
- `192.0.2.x` for IPs (RFC 5737 documentation range)
- `example.com` for domains
- Clearly fake names ("Alice", "Bob", "Acme Corp")

---

## 3. Portability Check

### Path Hardcoding
Search and fix:
```bash
grep -rniE "(\/home\/|\/Users\/|C:\\\\|~\/)" . --include="*.md"
grep -rniE "\/[a-z]+\/[a-z]+\/" . --include="*.md"  # Absolute paths
```

Replace with:
- Relative paths (`./config.yaml`)
- Environment variables (`$HOME`, `$XDG_CONFIG_HOME`)
- Platform-agnostic descriptions

### Environment Assumptions
- [ ] No hardcoded usernames
- [ ] No machine-specific paths
- [ ] No assumed installed software (or document requirements)
- [ ] No assumed environment variables (or document them)
- [ ] No OS-specific commands without alternatives

### Dependency Documentation
If the skill requires external tools:
```markdown
## Requirements
- `tool-name` - [installation link]
- Environment variable `API_KEY` must be set
```

---

## 4. Code Quality

### Debug Artifacts
Remove:
```bash
grep -rniE "(TODO|FIXME|XXX|HACK|DEBUG)" . --include="*.md"
grep -rniE "(console\.log|print\(|debugger)" . --include="*.md"
```

### Formatting
- [ ] Consistent markdown style
- [ ] Code blocks have language tags (```python, ```bash)
- [ ] Tables render correctly
- [ ] Links work (no broken references)
- [ ] No trailing whitespace
- [ ] Consistent heading hierarchy

### Content Quality
- [ ] No filler text (e.g., Lorem-ipsum, incomplete markers)
- [ ] No commented-out sections
- [ ] No duplicate content
- [ ] No outdated information
- [ ] Examples are complete and runnable

---

## 5. Documentation

### README.md Checklist
```markdown
# Skill Name

Brief description (1-2 sentences).

## What's Inside
[File listing with descriptions]

## Quick Summary  
[The core value proposition]

## Usage
[How to use this skill]

## Requirements (if any)
[Dependencies, API keys, etc.]

## Links (if relevant)
[Official docs, repos, etc.]

## License
[MIT recommended for skills]
```

### SKILL.md Checklist
- [ ] Clear "When to Use" section with specific triggers
- [ ] Quick reference for most common needs
- [ ] Logical organization of detailed content
- [ ] Cross-references to other files if multi-file

### Examples
- [ ] At least one complete, working example
- [ ] Examples use safe/fake data
- [ ] Examples are tested and verified

---

## 6. Testing

### Functional Testing
1. **Fresh load test**: Load skill in new session, verify it makes sense
2. **Trigger test**: Verify "When to Use" conditions actually match use cases
3. **Example test**: Run through all examples manually
4. **Edge case test**: What happens with unusual inputs?

### Integration Testing
If skill involves tools/commands:
```bash
# Test each command mentioned actually works
# Verify outputs match documentation
```

### Cross-Reference Testing
- [ ] All internal links work
- [ ] All external links are valid
- [ ] File references are correct

### Verification Script (optional but recommended)
Create `test.sh` or document manual test steps:
```bash
#!/bin/bash
# Verify skill integrity
echo "Checking for secrets..."
grep -rniE "(api[_-]?key|secret|password)" . --include="*.md" && exit 1
echo "Checking for hardcoded paths..."
grep -rniE "\/home\/" . --include="*.md" && exit 1
echo "✓ All checks passed"
```

---

## 7. Git Hygiene

### Before First Commit
Create `.gitignore`:
```gitignore
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

# Test artifacts
test-output/
```

### Commit History
- [ ] No secrets ever committed (check full history!)
- [ ] Clean, atomic commits
- [ ] Meaningful commit messages

```bash
# Check for secrets in history
git log -p | grep -iE "(api[_-]?key|secret|password|token)" 
```

If secrets were ever committed:
```bash
# Nuclear option - rewrite history (coordinate with collaborators!)
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch path/to/sensitive/file' HEAD
```

### Commit Message Format
```
type: short description

- Detail 1
- Detail 2

Types: feat, fix, docs, refactor, test, chore
```

### Pre-Push Checklist
```bash
# Final verification
git status                    # Nothing unexpected staged
git log --oneline -5          # Commits look right
git diff origin/main          # Changes are what you expect
```

---

## 8. Metadata

### Repository Settings
- [ ] Description filled in
- [ ] Topics/tags added (e.g., `claw`, `skill`, `ai-assistant`)
- [ ] License file present

### Recommended License
For open skills, MIT is simple and permissive:
```
MIT License

Copyright (c) [year] [name]

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
```

### ClawdHub Metadata (if publishing there)
In SKILL.md frontmatter:
```yaml
---
name: skill-name
description: One-line description
version: 1.0.0
author: username
tags: [tag1, tag2]
---
```

---

## Automated Audit Script

Run this before every publish:

```bash
#!/bin/bash
set -e

SKILL_DIR="${1:-.}"
cd "$SKILL_DIR"

echo "🔍 Auditing skill in: $SKILL_DIR"
echo ""

# 1. Structure
echo "=== STRUCTURE ==="
[ -f "SKILL.md" ] && echo "✓ SKILL.md exists" || echo "✗ SKILL.md MISSING"
[ -f "README.md" ] && echo "✓ README.md exists" || echo "✗ README.md MISSING"
echo ""

# 2. Security
echo "=== SECURITY ==="
if grep -rniE "(api[_-]?key|secret|password|token|bearer)=['\"]?[a-zA-Z0-9]" . --include="*.md" 2>/dev/null; then
    echo "✗ POTENTIAL SECRETS FOUND"
else
    echo "✓ No obvious secrets"
fi

if grep -rniE "(sk-|pk-|xai-|ghp_|gho_)[a-zA-Z0-9]" . --include="*.md" 2>/dev/null; then
    echo "✗ API KEY PATTERNS FOUND"
else
    echo "✓ No API key patterns"
fi
echo ""

# 3. Portability
echo "=== PORTABILITY ==="
if grep -rniE "\/home\/[a-z]+" . --include="*.md" 2>/dev/null; then
    echo "✗ HARDCODED HOME PATHS"
else
    echo "✓ No hardcoded home paths"
fi
echo ""

# 4. Quality
echo "=== QUALITY ==="
if grep -rniE "(TODO|FIXME|XXX)" . --include="*.md" 2>/dev/null; then
    echo "⚠ TODOs found (review these)"
else
    echo "✓ No TODOs"
fi
echo ""

# 5. Git
echo "=== GIT ==="
[ -f ".gitignore" ] && echo "✓ .gitignore exists" || echo "⚠ No .gitignore"
[ -d ".git" ] && echo "✓ Git initialized" || echo "✗ Not a git repo"
echo ""

echo "🏁 Audit complete"
```

---

## Publishing Flow

```
1. Run automated audit script
2. Fix any issues found
3. Manual review of checklist above
4. Final commit with clean message
5. Push to GitHub
6. (Optional) Submit to ClawdHub
```

## README Quality

A good README is discoverable and human-readable. See `docs/readme-quality.md` for detailed guidance.

### Quick Checks
- First line explains what it does (not "Welcome to...")
- No AI buzzwords (comprehensive, seamless, leverage, cutting-edge)
- Specific use cases, not vague claims
- Sounds like a person, not a press release
- No excessive emoji decoration in headers

### SEO Tips
- Use phrases people actually search for
- Put most important info in first paragraph
- Be specific about features (not "powerful validation" but "checks for API keys")


## Post-Publish

- [ ] Verify GitHub renders correctly
- [ ] Test fresh clone works
- [ ] Add to your AGENTS.md skill list if using locally
- [ ] Announce if relevant (Discord, etc.)
