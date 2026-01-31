# Installation Guide for Better Memory

## For ClawdHub / OpenClaw

Better Memory is designed to be installed via ClawdHub skills system.

### Automatic Installation (Recommended)

```bash
# Once published to ClawdHub
clawdbot skills install better-memory
```

This will:
1. Clone the skill to `~/.clawdbot/skills/better-memory`
2. Run `npm install` to install dependencies
3. Run post-install setup script
4. Make CLI available via `better-memory` command

### Manual Installation

```bash
cd ~/.clawdbot/skills
git clone https://github.com/clawdbot/better-memory.git
cd better-memory
npm install
```

### Verify Installation

```bash
# Check CLI works
better-memory --version

# Run tests
cd ~/.clawdbot/skills/better-memory
npm test
```

## Dependencies

Better Memory requires:
- Node.js (v18+ recommended)
- npm

All JavaScript dependencies are installed automatically:
- `@xenova/transformers` - Local ML embeddings (no API calls)
- `tiktoken` - Accurate token counting
- `sql.js` - SQLite database (pure JavaScript, no native binaries)

**No native compilation required** - works on all platforms (macOS, Linux, Windows).

## Usage After Installation

### CLI

```bash
# Store a memory
better-memory store "User prefers TypeScript"

# Search memories
better-memory search "programming preferences"

# View stats
better-memory stats
```

### Programmatic

```javascript
import { createContextGuardian } from 'better-memory';

const cg = createContextGuardian({
  dataDir: '~/.clawdbot/memory',
  contextLimit: 128000
});

await cg.initialize();
await cg.store('Important fact', { priority: 9 });
const results = await cg.search('fact');
```

## Troubleshooting

### "Cannot find module"
```bash
cd ~/.clawdbot/skills/better-memory
npm install
```

### "Permission denied"
```bash
chmod +x ~/.clawdbot/skills/better-memory/scripts/cli.js
```

### Tests failing
```bash
cd ~/.clawdbot/skills/better-memory
rm -rf node_modules package-lock.json
npm install
npm test
```

## For Skill Hub Submission

### Required Files ✅
- `SKILL.md` - Skill metadata with clawdbot section
- `package.json` - npm package with dependencies
- `README.md` - Usage documentation
- `lib/index.js` - Main export
- `scripts/setup.js` - Post-install setup
- Tests that pass (`npm test`)

### ClawdBot Metadata ✅

```yaml
name: better-memory
description: Semantic memory for AI agents
emoji: 🧠
requires:
  bins: []
  npm: ["@xenova/transformers", "tiktoken", "sql.js"]
install:
  - id: npm
    kind: npm
    label: Install Better Memory dependencies
    command: "cd ~/.clawdbot/skills/better-memory && npm install"
```

### Quality Checklist ✅
- [x] All tests pass (28/28)
- [x] No native dependencies (pure JS)
- [x] Works on all platforms
- [x] Clear documentation
- [x] Post-install setup included
- [x] CLI + programmatic API
- [x] Semantic versioning (2.0.0)
- [x] MIT licensed

## Support

Issues: https://github.com/clawdbot/better-memory/issues
