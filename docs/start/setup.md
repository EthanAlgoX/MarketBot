---
summary: "Setup guide: keep your MarketBot setup tailored while staying up-to-date"
read_when:
  - Setting up a new machine
  - You want “latest + greatest” without breaking your personal setup
---

# Setup

Last updated: 2026-01-01

## TL;DR
- **Tailoring lives outside the repo:** `~/.marketbot/workspace` (workspace) + `~/.marketbot/marketbot.json` (config).
- **Stable workflow:** install the macOS app; let it run the bundled Gateway.
- **Bleeding edge workflow:** run the Gateway yourself via `pnpm gateway:watch`, then let the macOS app attach in Local mode.

## Prereqs (from source)
- Node `>=22`
- `pnpm`
- Docker (optional; only for containerized setup/e2e — see [Docker](/install/docker))

## Tailoring strategy (so updates don’t hurt)

If you want “100% tailored to me” *and* easy updates, keep your customization in:

- **Config:** `~/.marketbot/marketbot.json` (JSON/JSON5-ish)
- **Workspace:** `~/.marketbot/workspace` (skills, prompts, memories; make it a private git repo)

Bootstrap once:

```bash
marketbot setup
```

From inside this repo, use the local CLI entry:

```bash
marketbot setup
```

If you don’t have a global install yet, run it via `pnpm marketbot setup`.

## Stable workflow (macOS app first)

1) Install + launch **MarketBot.app** (menu bar).
2) Complete the onboarding/permissions checklist (TCC prompts).
3) Ensure Gateway is **Local** and running (the app manages it).
4) Link surfaces (example: WhatsApp):

```bash
marketbot channels login
```

5) Sanity check:

```bash
marketbot health
```

If onboarding is not available in your build:
- Run `marketbot setup`, then `marketbot channels login`, then start the Gateway manually (`marketbot gateway`).

## Bleeding edge workflow (Gateway in a terminal)

Goal: work on the TypeScript Gateway, get hot reload, keep the macOS app UI attached.

### 0) (Optional) Run the macOS app from source too

If you also want the macOS app on the bleeding edge:

```bash
./scripts/restart-mac.sh
```

### 1) Start the dev Gateway

```bash
pnpm install
pnpm gateway:watch
```

`gateway:watch` runs the gateway in watch mode and reloads on TypeScript changes.

### 2) Point the macOS app at your running Gateway

In **MarketBot.app**:

- Connection Mode: **Local**
The app will attach to the running gateway on the configured port.

### 3) Verify

- In-app Gateway status should read **“Using existing gateway …”**
- Or via CLI:

```bash
marketbot health
```

### Common footguns
- **Wrong port:** Gateway WS defaults to `ws://127.0.0.1:18789`; keep app + CLI on the same port.
- **Where state lives:**
  - Credentials: `~/.marketbot/credentials/`
  - Sessions: `~/.marketbot/agents/<agentId>/sessions/`
  - Logs: `/tmp/marketbot/`

## Credential storage map

Use this when debugging auth or deciding what to back up:

- **WhatsApp**: `~/.marketbot/credentials/whatsapp/<accountId>/creds.json`
- **Telegram bot token**: config/env or `channels.telegram.tokenFile`
- **Discord bot token**: config/env (token file not yet supported)
- **Slack tokens**: config/env (`channels.slack.*`)
- **Pairing allowlists**: `~/.marketbot/credentials/<channel>-allowFrom.json`
- **Model auth profiles**: `~/.marketbot/agents/<agentId>/agent/auth-profiles.json`
- **Legacy OAuth import**: `~/.marketbot/credentials/oauth.json`
More detail: [Security](/gateway/security#credential-storage-map).

## Updating (without wrecking your setup)

- Keep `~/.marketbot/workspace` and `~/.marketbot/` as “your stuff”; don’t put personal prompts/config into the `marketbot` repo.
- Updating source: `git pull` + `pnpm install` (when lockfile changed) + keep using `pnpm gateway:watch`.

## Linux (systemd user service)

Linux installs use a systemd **user** service. By default, systemd stops user
services on logout/idle, which kills the Gateway. Onboarding attempts to enable
lingering for you (may prompt for sudo). If it’s still off, run:

```bash
sudo loginctl enable-linger $USER
```

For always-on or multi-user servers, consider a **system** service instead of a
user service (no lingering needed). See [Gateway runbook](/gateway) for the systemd notes.

## Related docs

- [Gateway runbook](/gateway) (flags, supervision, ports)
- [Gateway configuration](/gateway/configuration) (config schema + examples)
- [Discord](/channels/discord) and [Telegram](/channels/telegram) (reply tags + replyToMode settings)
- [MarketBot assistant setup](/start/marketbot)
- [macOS app](/platforms/macos) (gateway lifecycle)
