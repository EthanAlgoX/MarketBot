<p align="center">
  <img src="assets/logo.png" width="120" alt="MarketBot logo">
</p>

# MarketBot

Finance-first autonomous agent for market research and multi-channel delivery, with a built-in browser for data capture, a Web Control UI (Finance Desk), and a TUI for local file and workflow analysis.

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green)](https://nodejs.org/)

![Demo video](docs/video.gif)

## TL;DR

MarketBot runs a local Gateway that serves:

- Web Control UI: Desk, Stocks, Ops (Channels, Sessions, Cron, Logs), Research Chat
- Finance engine: Daily Stocks decision dashboards and research-style notes, browser-backed data capture
- Multi-channel delivery: built-in channels and optional extensions (including China IM plugins)
- TUI: interactive slash-command workflows and local file summaries

## Positioning

MarketBot turns live market context into repeatable finance analysis and delivers it where you work (chat channels, dashboards, scheduled runs).

- Built-in browser data capture: fetch market pages/endpoints through MarketBot's managed browser profile
- Finance outputs: decision dashboards plus research-style markdown reports
- Portfolio math: risk metrics, correlations, and optimization
- Agent research: browse and summarize with explicit assumptions and invalidation
- Delivery ops: connect channels, inspect sessions, schedule cron, tail logs

## China IM Channels (Extensions)

MarketBot supports common China IM surfaces via optional channel extensions in `extensions/*`:

- DingTalk (钉钉, Stream mode)
- WeCom (企业微信, secure webhook AES + signature)
- QQ Bot (QQ 机器人, Gateway WebSocket + REST)

You can inspect/enable them via:

```bash
pnpm -s marketbot plugins list
pnpm -s marketbot plugins enable dingtalk
pnpm -s marketbot plugins enable wecom
pnpm -s marketbot plugins enable qqbot
```

Feishu (飞书) is a common target and supported in related deployments; this repo focuses on the extensions above.

## Quick Start (Dev)

Prereqs: Node 22+, pnpm.

```bash
git clone https://github.com/marketbot/marketbot.git
cd marketbot
pnpm install
pnpm build
```

Initialize config/workspace:

```bash
pnpm -s marketbot setup
# or
pnpm -s marketbot onboard
```

Run a local gateway:

```bash
pnpm -s marketbot gateway run --bind loopback --port 18789
```

Open the Web Control UI (Finance Desk):

```text
http://127.0.0.1:18789/
```

Primary pages:

- Desk: `/` (or `/desk`)
- Stocks: `/stocks`
- Ops: `/channels` `/sessions` `/cron` `/logs`
- Research: `/chat`
- Connection: `/overview`

If your config is not yet set up for local mode, either run `setup/onboard` or explicitly set:

```bash
pnpm -s marketbot config set gateway.mode local
```

## Daily Stocks (Web Control UI)

Use Desk and Stocks for watchlists and daily runs.

- Watchlist: one symbol per line (US, A-share, HK)
- Daily Run: timeframe + report type (simple/full) + fundamentals toggle
- Report: research-style markdown output

## Research Chat (Web Control UI)

Use Chat for investigation workflows:

- Browse and capture sources with the built-in browser profile (`marketbot`)
- Attach local files (CSV/JSON/PDF) and ask for a finance-style summary
- Produce a memo-like report suitable for sharing in channels

### Symbol Conventions (Yahoo-backed)

- US equities: `AAPL`, `NVDA`
- China A-share: `600519` (auto-normalizes to `600519.SS`), `000001` (auto-normalizes to `000001.SZ`)
- Hong Kong: `hk00700`, `00700`, `700` (auto-normalizes to `00700.HK`)

## TUI (Finance Desk + File Processing)

The TUI supports slash commands and can summarize local CSV/JSON/text files without any model:

```bash
pnpm -s marketbot tui --url ws://127.0.0.1:18789 --token test-token
```

Inside the TUI:

```text
/file example/portfolio_holdings.csv
/file example/financial_statements.csv
/quit
```

Non-interactive (execute a slash command at startup):

```bash
pnpm -s marketbot tui --url ws://127.0.0.1:18789 --token test-token --message "/file example/portfolio_holdings.csv"
```

## Channels + Messaging

```bash
pnpm -s marketbot channels list
pnpm -s marketbot channels status --probe
pnpm -s marketbot message send --channel telegram --target @your_chat --message "Hello"
```

## CLI (Optional)

This repo still ships a CLI for scripting and dev workflows. The primary user surfaces are Web Control UI and TUI.

## Repo Layout

| Directory | Contents |
|-----------|----------|
| `src/` | CLI, gateway, channels, browser, finance, infra |
| `extensions/` | Optional plugins (workspace packages) |
| `skills/` | Reusable skills and workflows |
| `apps/` | Native clients (macOS, iOS, Android) |
| `ui/` | Web Control UI (current) |
| `dashboard/` | Web UI (legacy/experimental) |
| `docs/` | Documentation sources |

## Development

```bash
pnpm lint
pnpm test
pnpm build
```

## Documentation

- CLI overview: https://docs.marketbot.ai/cli
- Gateway: https://docs.marketbot.ai/cli/gateway
- Browser: https://docs.marketbot.ai/cli/browser
- Finance: https://docs.marketbot.ai/cli/finance
- Analyze: https://docs.marketbot.ai/cli/analyze
- Channels: https://docs.marketbot.ai/cli/channels
- Message: https://docs.marketbot.ai/cli/message
- Plugins: https://docs.marketbot.ai/cli/plugins
- Skills: https://docs.marketbot.ai/cli/skills
- Dashboard: https://docs.marketbot.ai/web/dashboard
- Control UI: https://docs.marketbot.ai/web/control-ui

## License

MIT. See [LICENSE](LICENSE).
