---
summary: "CLI reference for `marketbot memory` (status/index/search/maintenance)"
read_when:
  - You want to index or search semantic memory
  - You’re debugging memory availability or indexing
---

# `marketbot memory`

Manage semantic memory indexing and search.
Provided by the active memory plugin (default: `memory-core`; set `plugins.slots.memory = "none"` to disable).

Related:
- Memory concept: [Memory](/concepts/memory)
- Plugins: [Plugins](/plugins)

## Examples

```bash
marketbot memory status
marketbot memory status --deep
marketbot memory status --deep --index
marketbot memory status --deep --index --verbose
marketbot memory index
marketbot memory index --verbose
marketbot memory search "release checklist"
marketbot memory search "release checklist" --depth l0
marketbot memory search "release checklist" --max-depth l1
marketbot memory abstract
marketbot memory janitor --dry-run
marketbot memory session-state
marketbot memory status --agent main
marketbot memory index --agent main --verbose
```

## Options

Common:

- `--agent <id>`: scope to a single agent (default: all configured agents).
- `--verbose`: emit detailed logs during probes and indexing.

Notes:
- `memory status --deep` probes vector + embedding availability.
- `memory status --deep --index` runs a reindex if the store is dirty.
- `memory index --verbose` prints per-phase details (provider, model, sources, batch activity).
- `memory status` includes any extra paths configured via `memorySearch.extraPaths`.
- `memory status` also shows maintenance telemetry (thresholds + last auto runs).
- `memory search --depth l0|l1|l2` restricts to an exact layer.
- `memory search --max-depth l0|l1|l2` searches from L0 down to the selected depth.
- `memory search --include-expired` includes expired P1/P2 entries.
- `memory abstract` rebuilds `.abstract` indexes under `memory/`.
- `memory janitor` archives expired P1/P2 files into `memory/archive/`.
- `memory session-state` refreshes `SESSION-STATE.md`.
