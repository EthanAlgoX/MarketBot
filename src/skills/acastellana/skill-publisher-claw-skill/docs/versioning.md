# Skill Versioning Guide

Use semantic versioning (SemVer) for your skills: `MAJOR.MINOR.PATCH`

## Version Numbers

### MAJOR (1.0.0 → 2.0.0)
Breaking changes that require users to update their usage:
- Renamed or removed files that were part of the public interface
- Changed SKILL.md structure significantly
- Removed features or content that users may depend on
- Changed "When to Use" triggers substantially

### MINOR (1.0.0 → 1.1.0)
New features or content, backwards compatible:
- Added new sections or files
- Expanded existing documentation
- Added new examples
- Improved but didn't break existing content

### PATCH (1.0.0 → 1.0.1)
Bug fixes and minor improvements:
- Fixed typos or errors
- Updated broken links
- Clarified confusing content
- Fixed formatting issues

## How to Version

### 1. Tag your releases
```bash
git tag -a v1.0.0 -m "Initial release"
git push origin v1.0.0
```

### 2. Update SKILL.md header (optional)
```markdown
# My Skill v1.2.0
```

### 3. Maintain a CHANGELOG.md (recommended)
```markdown
# Changelog

## [1.2.0] - 2026-01-30
### Added
- New section on advanced usage

## [1.1.0] - 2026-01-15
### Added
- Examples for common scenarios
### Fixed
- Typos in quick reference
```

## Pre-release Versions

For work-in-progress or beta versions:
- `1.0.0-alpha.1` - Early development
- `1.0.0-beta.1` - Feature complete, testing
- `1.0.0-rc.1` - Release candidate

## First Release

Start at `1.0.0` when:
- Skill is complete and tested
- Documentation is finished
- Ready for public use

Start at `0.1.0` when:
- Still in development
- API/structure may change
- Not recommended for production use

## Migration Guides

For major version bumps, include a migration guide:

```markdown
## Migrating from v1.x to v2.0

### Breaking Changes

1. **SKILL.md renamed sections**
   - Old: `## Commands`
   - New: `## Quick Reference`

2. **Removed deprecated content**
   - `old-file.md` has been removed
   - Content moved to `new-location.md`

### How to Update

1. Update any references to old section names
2. Check your automation for removed files
```

## Deprecation Process

When removing features:

1. **Announce deprecation** (minor version)
   ```markdown
   > ⚠️ Deprecated: `old-section` will be removed in v2.0
   ```

2. **Keep deprecated content** for at least one minor version

3. **Remove in major version** with migration guide

## Tagging Workflow

```bash
# Check current version
git describe --tags

# Create new version
git tag -a v1.2.0 -m "Add advanced examples"
git push origin v1.2.0

# List all versions
git tag -l "v*"
```
