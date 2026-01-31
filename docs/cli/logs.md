---
summary: "CLI reference for `marketbot logs` (tail gateway logs via RPC)"
read_when:
  - You need to tail Gateway logs remotely (without SSH)
  - You want JSON log lines for tooling
---

# `marketbot logs`

Tail Gateway file logs over RPC (works in remote mode).

Related:
- Logging overview: [Logging](/logging)

## Examples

```bash
marketbot logs
marketbot logs --follow
marketbot logs --json
marketbot logs --limit 500
```

