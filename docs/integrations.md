[English](integrations.md) | [简体中文](integrations_zh-CN.md)

# Integrations, operations and deployment

This guide extends the optional features in the [README](../README.md). Complete its local calculation first and keep `MARKETBOT_CONFIG_PATH` and `MARKETBOT_WORKSPACE` set. Account integrations require your own credentials; deterministic tests do not establish authorization or platform delivery.

## Language settings

`agents.defaults.language` defaults to `"en"`; `"zh"` selects Simplified Chinese. Use `marketbot --language zh ...` for one invocation, or save a preference with:

```bash
marketbot --config "$MARKETBOT_CONFIG_PATH" language --set zh
marketbot --config "$MARKETBOT_CONFIG_PATH" language --json
marketbot --config "$MARKETBOT_CONFIG_PATH" language --set en
```

Agent replies, market report sections and intelligence daily digest sections follow the preference; an explicit user request for another language takes priority. Initialization, language settings and key status screens support both languages. Commands, technical `--help`, JSON field names, original source data, provider errors and financial tool warnings retain their text. Existing custom workspace instructions are preserved.

## Model providers

Configure `agents.defaults.provider/model` and `providers.<name>`. Supported providers include custom, Azure OpenAI, OpenRouter, Anthropic, OpenAI, DeepSeek, Gemini, Zhipu, DashScope, Moonshot, MiniMax, AiHubMix, SiliconFlow, VolcEngine, vLLM and Bedrock, plus OpenAI Codex / GitHub Copilot OAuth. Use model IDs and quotas from the provider's current documentation.

```bash
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" provider login openai-codex
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" provider login github-copilot
```

OAuth login uses the current operating-system user's authentication store. Separate financial workspaces do not create separate accounts. `authenticationStatus: not_checked` means authentication validity was not checked and does not establish a successful login. Full Gateway requires a usable model; finance-only runs native scheduled tasks independently.

## MCP

`onboard` configures the bundled financial stdio service. The current Python interpreter runs `-m marketbot.mcp.finance`, passing the active workspace and market-source settings. MCP and native financial tools share implementations; identical data from the two interfaces does not constitute independent source confirmation. The default read-only surface excludes thesis/watch mutations, evidence recording, signal logging and report writes.

```bash
python -m marketbot.mcp.finance --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" --help
```

This is a protocol service: it waits for client stdio messages and provides no browser page or HTTP port. Custom server configuration lives under `tools.mcpServers`, supporting stdio, HTTP and SSE. `enabled`, `enabledTools`, `toolTimeout`, `env` and `headers` control the selected server; unreachable services produce diagnostics. The Alpha Vantage preset is disabled by default and requires `ALPHA_VANTAGE_API_KEY` and explicit enablement. Consult the official [MCP documentation](https://www.alphavantage.co/mcp/) for authorization at `https://mcp.alphavantage.co/mcp`.

## Skills

```bash
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" skills search "portfolio"
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" skills score show --json
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" skills install --help
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" skills score reset --help
```

Bundled skills ship with the package; workspace `skills/` holds user-installed content. Preserve attribution and licenses when installing remote skills, and inspect their tool and script requirements. Scores reflect feedback and operational success; they do not validate investment returns or research conclusions.

## Channels

```bash
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" channels status --json
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" gateway
```

Configure `channels.<name>.enabled`, platform credentials and `allowFrom`. Use `marketbot/config/schema.py` for the actual fields. The ten channels are Telegram, Discord, WhatsApp, Feishu, Mochat, DingTalk, Slack, Email, QQ and Matrix. An enabled setting does not establish valid credentials or an online service; complete login and send/receive acceptance on the actual platform.

Matrix requires its optional dependencies:

```bash
python -m pip install -e '.[matrix]'
```

WhatsApp requires **Node.js 20+** and npm. `channels login` builds and starts the local bridge and displays the QR login flow. Gateway is a separate process that connects to `bridgeUrl`. The bridge actually listens on `127.0.0.1:3001`; this is independent of Gateway's legacy `--port` argument.

```bash
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" channels login
```

`gateway --finance-only` can deliver explicitly configured native alerts. Incoming chat receives an explanation that this mode does not support model chat; it does not launch model tasks.

## Optional CLI bridges

`status --json` reports enabled settings and executable availability for browser, Lark, Twitter and Xiaohongshu. Local evaluation does not establish that their real account operations have passed.

| Tool | Main use | Configuration and dependencies |
| --- | --- | --- |
| Browser | Web reading and site adapters | `tools.browser`; requires `bb-browser` and an available browser; see the [adapter catalog](browser_adapter_catalog.md) |
| Lark | Documents, spreadsheets, messages and knowledge bases | `tools.larkCli`; installation and OAuth in the [official Lark CLI repository](https://github.com/larksuite/cli); current installer: `npx @larksuite/cli@latest install` |
| Twitter | Search, timelines and authorized writes | `tools.twitterCli`; requires `twitter-cli` and your login. The repository wrapper accepts `MARKETBOT_TWITTER_PYTHON` for the interpreter and `MARKETBOT_TWITTER_CLI_ROOT` for the module directory, without a machine-specific path |
| Xiaohongshu | Reading, search and explicitly authorized operations | `tools.xiaohongshuCli`; requires the corresponding CLI and local login. Cookies remain in ignored directories, outside Git and installation packages |

Use each external CLI's current `--help` and official documentation for arguments and login. Writes require permitted configuration capabilities and user authorization; successful reads do not establish write acceptance. Use your own actual Feishu resource IDs, chat IDs and spreadsheet tokens.

## Intelligence scheduling and model Heartbeat

`intel source-add` supports RSS and websites. RSS fetches over async HTTP with a request timeout, then parses RSS/Atom. Unknown publication times remain empty. Sources are deduplicated; fetched HTML does not provide complete content understanding or browser rendering.

`intel schedule-collect`, `schedule-daily` and `schedule-latest-daily` save native tasks. Manage them with `intel schedule-list/schedule-remove`. Do not supply both a cron expression and an interval; invalid cron expressions fail immediately. Financial scheduling uses separate `finance schedule-list/unschedule` commands.

```bash
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" market heartbeat-setup --symbols SPY,QQQ
```

This writes `HEARTBEAT.md` and does not itself perform research. Full Gateway's model Heartbeat reads it. `--finance-only` neither runs model Heartbeat nor accepts mixed-in model cron tasks. Gateway's `--port` remains for compatibility and does not start an HTTP listener.

## RL, OpenClaw and metrics

The README's local RL examples cover evaluation, episodes, datasets, adapters and export bundles. The jsonl-supervised and Slime `rl train` adapters currently export artifacts only, including with `--no-dry-run`; they do not train model parameters. The generated Slime `generate` shim uses MarketSignalTool's rule-based signals. Real model learning, GPUs and an external OpenClaw-RL environment require separate implementation and acceptance.

```bash
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" rl inspect-openclaw-run --bundle-dir .local/readme/openclaw --json
marketbot rl launch-openclaw --help
marketbot rl serve-env --help
marketbot rl list-openclaw-runs --help
marketbot rl compare-openclaw-runs --help
marketbot rl latest-openclaw-report --help
marketbot rl latest-openclaw-metrics --help
marketbot rl serve-metrics --help
```

`serve-env` is a separate RL HTTP environment supporting episode allocation, reset, actions, step advancement, rewards and close. `serve-metrics` exposes actual `/healthz`, `/metrics`, `/summary.json`, `/alerts` and `/alerts/prometheus` HTTP routes. Reports and comparisons read existing run logs; empty results with no logs do not establish successful training. Default loopback binding suits local debugging; inspect `--help` for host, port and paths before starting a service.

## Docker

Docker Engine / Compose is required. Source builds include Node.js 20 and the WhatsApp bridge. Gateway has no HTTP API, so Compose does not publish a Gateway port.

```bash
docker build -t marketbot-local .
docker compose run --rm marketbot-cli onboard
docker compose run --rm marketbot-cli status --json
# Configure models/channels in the host's ~/.marketbot/config.json, then start
docker compose up -d marketbot-gateway
docker compose logs --tail 100 marketbot-gateway
```

Compose mounts host `~/.marketbot` at container `/root/.marketbot`; configured workspace paths must be accessible inside the container. For native tasks only, set `command: ["gateway", "--finance-only"]` in a local Compose override. Configuration, sessions and cookies are runtime data and should stay outside images and Git.

The WhatsApp bridge still needs a separate process and QR login in the same container environment; the main Gateway service does not start it automatically. Container `127.0.0.1` refers to the container itself, not a host or another container's loopback bridge. See the evaluation report for container-build and real-account acceptance status.
