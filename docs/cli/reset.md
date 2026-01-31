---
summary: "CLI reference for `marketbot reset` (reset local state/config)"
read_when:
  - You want to wipe local state while keeping the CLI installed
  - You want a dry-run of what would be removed
---

# `marketbot reset`

Reset local config/state (keeps the CLI installed).

```bash
marketbot reset
marketbot reset --dry-run
marketbot reset --scope config+creds+sessions --yes --non-interactive
```

