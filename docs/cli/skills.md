---
summary: "CLI reference for `marketbot skills` (list/info/check) and skill eligibility"
read_when:
  - You want to see which skills are available and ready to run
  - You want to debug missing binaries/env/config for skills
---

# `marketbot skills`

Inspect skills (bundled + workspace + managed overrides) and see what’s eligible vs missing requirements.

Related:
- Skills system: [Skills](/tools/skills)
- Skills config: [Skills config](/tools/skills-config)
- MarketHub installs: [MarketHub](/tools/markethub)

## Commands

```bash
marketbot skills list
marketbot skills list --eligible
marketbot skills info <name>
marketbot skills check
```
