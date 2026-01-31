---
summary: "Uninstall MarketBot completely (CLI, service, state, workspace)"
read_when:
  - You want to remove MarketBot from a machine
  - The gateway service is still running after uninstall
---

# Uninstall

Two paths:
- **Easy path** if `marketbot` is still installed.
- **Manual service removal** if the CLI is gone but the service is still running.

## Easy path (CLI still installed)

Recommended: use the built-in uninstaller:

```bash
marketbot uninstall
```

Non-interactive (automation / npx):

```bash
marketbot uninstall --all --yes --non-interactive
npx -y marketbot uninstall --all --yes --non-interactive
```

Manual steps (same result):

1) Stop the gateway service:

```bash
marketbot gateway stop
```

2) Uninstall the gateway service (launchd/systemd/schtasks):

```bash
marketbot gateway uninstall
```

3) Delete state + config:

```bash
rm -rf "${MARKETBOT_STATE_DIR:-$HOME/.marketbot}"
```

If you set `MARKETBOT_CONFIG_PATH` to a custom location outside the state dir, delete that file too.

4) Delete your workspace (optional, removes agent files):

```bash
rm -rf ~/.marketbot/workspace
```

5) Remove the CLI install (pick the one you used):

```bash
npm rm -g marketbot
pnpm remove -g marketbot
bun remove -g marketbot
```

6) If you installed the macOS app:

```bash
rm -rf /Applications/MarketBot.app
```

Notes:
- If you used profiles (`--profile` / `MARKETBOT_PROFILE`), repeat step 3 for each state dir (defaults are `~/.marketbot-<profile>`).
- In remote mode, the state dir lives on the **gateway host**, so run steps 1-4 there too.

## Manual service removal (CLI not installed)

Use this if the gateway service keeps running but `marketbot` is missing.

### macOS (launchd)

Default label is `bot.molt.gateway` (or `bot.molt.<profile>`; legacy `com.marketbot.*` may still exist):

```bash
launchctl bootout gui/$UID/bot.molt.gateway
rm -f ~/Library/LaunchAgents/bot.molt.gateway.plist
```

If you used a profile, replace the label and plist name with `bot.molt.<profile>`. Remove any legacy `com.marketbot.*` plists if present.

### Linux (systemd user unit)

Default unit name is `marketbot-gateway.service` (or `marketbot-gateway-<profile>.service`):

```bash
systemctl --user disable --now marketbot-gateway.service
rm -f ~/.config/systemd/user/marketbot-gateway.service
systemctl --user daemon-reload
```

### Windows (Scheduled Task)

Default task name is `MarketBot Gateway` (or `MarketBot Gateway (<profile>)`).
The task script lives under your state dir.

```powershell
schtasks /Delete /F /TN "MarketBot Gateway"
Remove-Item -Force "$env:USERPROFILE\.marketbot\gateway.cmd"
```

If you used a profile, delete the matching task name and `~\.marketbot-<profile>\gateway.cmd`.

## Normal install vs source checkout

### Normal install (install.sh / npm / pnpm / bun)

If you used `https://marketbot.bot/install.sh` or `install.ps1`, the CLI was installed with `npm install -g marketbot@latest`.
Remove it with `npm rm -g marketbot` (or `pnpm remove -g` / `bun remove -g` if you installed that way).

### Source checkout (git clone)

If you run from a repo checkout (`git clone` + `marketbot ...` / `bun run marketbot ...`):

1) Uninstall the gateway service **before** deleting the repo (use the easy path above or manual service removal).
2) Delete the repo directory.
3) Remove state + workspace as shown above.
