---
summary: "CLI reference for `marketbot browser` (profiles, tabs, actions)"
read_when:
  - You use `marketbot browser` and want examples for common tasks
  - You want to control a browser running on another machine via a node host
---

# `marketbot browser`

Manage MarketBot’s browser control server and run browser actions (tabs, snapshots, screenshots, navigation, clicks, typing).

Related:
- Browser tool + API: [Browser tool](/tools/browser)

## Common flags

- `--url <gatewayWsUrl>`: Gateway WebSocket URL (defaults to config).
- `--token <token>`: Gateway token (if required).
- `--timeout <ms>`: request timeout (ms).
- `--browser-profile <name>`: choose a browser profile (default from config).
- `--json`: machine-readable output (where supported).

## Quick start (local)

```bash
marketbot browser --browser-profile marketbot start
marketbot browser --browser-profile marketbot open https://example.com
marketbot browser --browser-profile marketbot snapshot
```

## Profiles

Profiles are named browser routing configs. In practice:
- `marketbot`: launches/attaches to a dedicated MarketBot-managed Chrome instance (isolated user data dir).

```bash
marketbot browser profiles
marketbot browser create-profile --name work --color "#FF5A36"
marketbot browser delete-profile --name work
```

Use a specific profile:

```bash
marketbot browser --browser-profile work tabs
```

## Tabs

```bash
marketbot browser tabs
marketbot browser open https://docs.marketbot.ai
marketbot browser focus <targetId>
marketbot browser close <targetId>
```

## Snapshot / screenshot / actions

Snapshot:

```bash
marketbot browser snapshot
```

Screenshot:

```bash
marketbot browser screenshot
```

Navigate/click/type (ref-based UI automation):

```bash
marketbot browser navigate https://example.com
marketbot browser click <ref>
marketbot browser type <ref> "hello"
```

## Remote browser control (node host proxy)

If the Gateway runs on a different machine than the browser, run a **node host** on the machine that has Chrome/Brave/Edge/Chromium. The Gateway will proxy browser actions to that node (no separate browser control server required).

Use `gateway.nodes.browser.mode` to control auto-routing and `gateway.nodes.browser.node` to pin a specific node if multiple are connected.

Security + remote setup: [Browser tool](/tools/browser), [Remote access](/gateway/remote), [Tailscale](/gateway/tailscale), [Security](/gateway/security)
