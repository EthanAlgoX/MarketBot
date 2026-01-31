# Skill Deprecation Process

How to properly sunset a skill or remove features.

## When to Deprecate

Consider deprecation when:
- Skill is replaced by a better alternative
- Underlying tool/service no longer exists
- Content is outdated and won't be maintained
- Merging into another skill

## Deprecation vs Removal

**Deprecation**: Still works but discouraged
- Give users time to migrate
- Keep skill functional
- Add warnings

**Removal**: No longer available
- Only after deprecation period
- Provide migration guide
- Archive, don't delete

## Process

### 1. Announce Deprecation

Add warning banner to README.md and SKILL.md:

```markdown
> ⚠️ **DEPRECATED**: This skill is deprecated and will be archived on [DATE].
> Please migrate to [alternative-skill](link).
> See [Migration Guide](#migration) below.
```

### 2. Update Metadata

Add deprecation notice to any metadata:

```yaml
---
name: old-skill
status: deprecated
deprecated_date: 2026-01-30
replacement: new-skill
removal_date: 2026-04-30
---
```

### 3. Create Migration Guide

Document how to migrate:

```markdown
## Migration Guide

### Why Migrate?
[Explain why the skill is deprecated]

### Replacement
The recommended replacement is [new-skill](link).

### Key Differences
| Old | New |
|-----|-----|
| `old-command` | `new-command` |

### Step-by-Step Migration
1. Install replacement: `...`
2. Update your config: `...`
3. Test functionality: `...`
```

### 4. Maintain During Deprecation

- Keep skill functional
- Accept critical bug fixes only
- No new features
- Duration: minimum 3 months recommended

### 5. Final Removal

When removal date arrives:

1. **Archive the repository** (don't delete)
   ```bash
   gh repo archive owner/skill-name
   ```

2. **Update README** with final notice:
   ```markdown
   # ⚠️ ARCHIVED
   
   This skill has been archived and is no longer maintained.
   
   **Replacement**: [new-skill](link)
   **Migration Guide**: [link to guide]
   **Last working version**: v1.2.3
   ```

3. **Keep accessible** for reference
   - Users may need to reference old documentation
   - Historical context is valuable

## Template: Deprecation Notice

```markdown
---

## ⚠️ Deprecation Notice

**Status**: Deprecated as of [DATE]
**Removal Date**: [DATE]
**Replacement**: [new-skill](link)

### Why?
[Brief explanation]

### What You Should Do
1. Review the [migration guide](#migration-guide)
2. Switch to [replacement] before [removal date]
3. Report issues if migration is blocked

### Timeline
- [DATE]: Deprecation announced
- [DATE]: Last feature update
- [DATE]: Last bug fixes
- [DATE]: Archived

---
```

## Communicating Deprecation

### Where to Announce

1. **In the skill itself** (README, SKILL.md)
2. **Release notes** (if using GitHub releases)
3. **Community channels** (Discord, forums)
4. **ClawdHub** (if published there)

### What to Include

- Clear deprecation date
- Clear removal date  
- Reason for deprecation
- Migration path
- Where to get help

## For Users of Deprecated Skills

### If You Depend on a Deprecated Skill

1. **Don't panic** - deprecation ≠ immediate removal
2. **Read the migration guide**
3. **Plan your migration** before removal date
4. **Fork if necessary** - if you need to maintain it yourself
5. **Provide feedback** - if migration is difficult, tell the maintainer

### If There's No Replacement

You can:
- Fork and maintain yourself
- Request the maintainer keep it alive
- Build your own alternative
- Accept the loss and adapt workflows
