# skill-publisher-claw-skill

A Claw skill and toolkit for preparing skills for public release.

## Tools

| Script | Description |
|--------|-------------|
| `audit.sh` | Check skill for issues (secrets, paths, quality) |
| `fix.sh` | Auto-fix common issues |
| `scaffold.sh` | Create new skill from templates |
| `publish.sh` | One-command audit → commit → push |
| `analyze.sh` | Size/token analysis and recommendations |
| `validate-links.sh` | Check internal and external links |
| `score.sh` | Quality score (0-100) with grade |
| `changelog.sh` | Generate changelog from commits |

## Quick Start

### Check a skill before publishing
```bash
./audit.sh /path/to/skill
```

### Fix common issues automatically
```bash
./fix.sh /path/to/skill        # Interactive
./fix.sh /path/to/skill --auto # Automatic
```

### Create a new skill
```bash
./scaffold.sh my-new-skill
```

### Publish in one command
```bash
./publish.sh /path/to/skill
```

### Get quality score
```bash
./score.sh /path/to/skill
```

## The Checklist

Every skill is checked against:

1. **STRUCTURE** — Required files, logical organization
2. **SECURITY** — No secrets, keys, PII
3. **PORTABILITY** — No hardcoded paths
4. **QUALITY** — No debug code, clean formatting
5. **DOCS** — README, SKILL.md, examples
6. **TESTING** — Verified functionality
7. **GIT** — Clean history, .gitignore
8. **METADATA** — License, description

## Templates

```
templates/
├── SKILL.template.md      # Skill entry point template
├── README.template.md     # GitHub readme template
├── LICENSE.template       # MIT license
├── gitignore.template     # Standard .gitignore
├── pre-commit-hook        # Git hook for security
└── github-actions/
    └── skill-audit.yml    # CI workflow
```

### Install pre-commit hook
```bash
cp templates/pre-commit-hook /path/to/skill/.git/hooks/pre-commit
chmod +x /path/to/skill/.git/hooks/pre-commit
```

### Add CI to your skill
```bash
mkdir -p /path/to/skill/.github/workflows
cp templates/github-actions/skill-audit.yml /path/to/skill/.github/workflows/
```

## Documentation

- `docs/versioning.md` — Semantic versioning guide
- `docs/deprecation.md` — How to sunset a skill

## Quality Grades

| Score | Grade | Meaning |
|-------|-------|---------|
| 90-100 | A | Excellent, ready for publication |
| 80-89 | B | Good quality, minor improvements possible |
| 70-79 | C | Acceptable, consider improvements |
| 60-69 | D | Needs work before publishing |
| 0-59 | F | Not ready, significant issues |

## Example Workflow

```bash
# 1. Create new skill
./scaffold.sh my-awesome-skill
cd my-awesome-skill

# 2. Edit content
vim SKILL.md
vim README.md

# 3. Check quality
../score.sh .

# 4. Fix any issues
../fix.sh .

# 5. Validate links
../validate-links.sh .

# 6. Publish
../publish.sh .
```

## License

MIT

## Resources

- [ClawdHub](https://clawdhub.com) - Skill marketplace
- [Claw Docs](https://docs.clawd.bot) - Main documentation
- [GitHub Issues](https://github.com/acastellana/skill-publisher-claw-skill/issues) - Report bugs
