---
summary: "CLI reference for `marketbot agents` (list/add/delete/set identity)"
read_when:
  - You want multiple isolated agents (workspaces + routing + auth)
---

# `marketbot agents`

Manage isolated agents (workspaces + auth + routing).

Related:
- Multi-agent routing: [Multi-Agent Routing](/concepts/multi-agent)
- Agent workspace: [Agent workspace](/concepts/agent-workspace)

## Examples

```bash
marketbot agents list
marketbot agents add work --workspace ~/.marketbot/workspace-work
marketbot agents set-identity --workspace ~/.marketbot/workspace --from-identity
marketbot agents set-identity --agent main --avatar avatars/marketbot.png
marketbot agents delete work
```

## Identity files

Each agent workspace can include an `IDENTITY.md` at the workspace root:
- Example path: `~/.marketbot/workspace/IDENTITY.md`
- `set-identity --from-identity` reads from the workspace root (or an explicit `--identity-file`)

Avatar paths resolve relative to the workspace root.

## Set identity

`set-identity` writes fields into `agents.list[].identity`:
- `name`
- `theme`
- `emoji`
- `avatar` (workspace-relative path, http(s) URL, or data URI)

Load from `IDENTITY.md`:

```bash
marketbot agents set-identity --workspace ~/.marketbot/workspace --from-identity
```

Override fields explicitly:

```bash
marketbot agents set-identity --agent main --name "MarketBot" --emoji "📈" --avatar avatars/marketbot.png
```

Config sample:

```json5
{
  agents: {
    list: [
      {
        id: "main",
        identity: {
          name: "MarketBot",
          theme: "space lobster",
          emoji: "📈",
          avatar: "avatars/marketbot.png"
        }
      }
    ]
  }
}
```
