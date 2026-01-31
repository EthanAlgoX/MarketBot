---
summary: "CLI reference for `marketbot plugins` (list, install, enable/disable, doctor)"
read_when:
  - You want to install or manage in-process Gateway plugins
  - You want to debug plugin load failures
---

# `marketbot plugins`

Manage Gateway plugins/extensions (loaded in-process).

Related:
- Plugin system: [Plugins](/plugin)
- Plugin manifest + schema: [Plugin manifest](/plugins/manifest)
- Security hardening: [Security](/gateway/security)

## Commands

```bash
marketbot plugins list
marketbot plugins info <id>
marketbot plugins enable <id>
marketbot plugins disable <id>
marketbot plugins doctor
marketbot plugins update <id>
marketbot plugins update --all
```

Bundled plugins ship with MarketBot but start disabled. Use `plugins enable` to
activate them.

All plugins must ship a `marketbot.plugin.json` file with an inline JSON Schema
(`configSchema`, even if empty). Missing/invalid manifests or schemas prevent
the plugin from loading and fail config validation.

### Install

```bash
marketbot plugins install <path-or-spec>
```

Security note: treat plugin installs like running code. Prefer pinned versions.

Supported archives: `.zip`, `.tgz`, `.tar.gz`, `.tar`.

Use `--link` to avoid copying a local directory (adds to `plugins.load.paths`):

```bash
marketbot plugins install -l ./my-plugin
```

### Update

```bash
marketbot plugins update <id>
marketbot plugins update --all
marketbot plugins update <id> --dry-run
```

Updates only apply to plugins installed from npm (tracked in `plugins.installs`).
