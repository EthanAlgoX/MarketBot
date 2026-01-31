---
name: glab-auth
description: Use when setting up or managing GitLab CLI (glab) authentication. Covers login, logout, status, docker helper, and related auth commands.
---

# glab auth

Manage glab’s authentication state.

## When to use

- Setting up GitLab CLI auth for the first time
- Updating or switching accounts
- Checking auth status
- Configuring Docker auth helper for GitLab registry

## Quick start

1) Login:
```bash
glab auth login
```

2) Check status:
```bash
glab auth status
```

3) Logout:
```bash
glab auth logout
```

## Subcommands

See [references/commands.md](references/commands.md) for subcommand details and usage notes:
- `login`
- `logout`
- `status`
- `configure-docker`
- `docker-helper`
- `dpop-gen`
