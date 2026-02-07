<p align="center">
  <img src="assets/logo.png" width="120" alt="MarketBot logo">
</p>

# MarketBot

Finance-first autonomous agent for market research and multi-channel delivery, with a built-in browser for data capture, a Web Control UI, and a TUI focused on watchlists, decision dashboards, and research-style reports.

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green)](https://nodejs.org/)

![Demo video](docs/video.gif)

## What It Does

- Gateway-first runtime (WebSocket hub) for sessions, routing, tools, and channel delivery
- Agents with tool use (web, browser, desktop on macOS, memory, media, exec)
- Multi-channel messaging (built-in + extensions)
- Finance engine for browser-backed market data + analysis (technicals, risk, portfolio, optimization)
- Web Control UI for finance runs (Stocks) and gateway operations (channels, sessions, cron, logs)
- TUI for interactive workflows (watchlists, commands, local file summaries)

## Finance-First: Positioning + Differentiators

MarketBot is built to turn live market context into repeatable analysis and deliver it where you work (chat channels, dashboards, and automation hooks).

- Built-in browser data capture: fetch market pages/endpoints through MarketBot's managed browser profile
- Structured finance outputs: JSON-friendly results for quotes, charts, indicators, risk, correlations, briefs, and rule-based decision dashboards
- Portfolio math included: risk metrics, correlation matrix, and min-variance optimization
- Agent-driven research: `analyze` provides structured market analysis with explicit assumptions and risk/invalidation
- Multi-channel delivery: use `message`/`channels` to push alerts, summaries, or reports to your teams

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

Open the Web Control UI:

```text
http://127.0.0.1:18789/
```

If your config is not yet set up for local mode, either run `setup/onboard` or explicitly set:

```bash
pnpm -s marketbot config set gateway.mode local
```

## Daily Stocks (Web Control UI)

The Web Control UI includes a finance-first Stocks view (Finance -> Stocks) for watchlists and daily runs.

- Watchlist: one symbol per line (US, A-share, HK)
- Daily Run: timeframe + report type (simple/full) + fundamentals toggle
- Report: research-style markdown output

## Finance (Optional CLI for Scripting)

Market data commands fetch via MarketBot's built-in browser by default (browser profile: `marketbot`).

```bash
pnpm -s marketbot finance quote AAPL --json
pnpm -s marketbot finance chart AAPL --timeframe 6mo --json
pnpm -s marketbot finance summary AAPL --timeframe 6mo --json
pnpm -s marketbot finance technicals AAPL --timeframe 6mo --json
pnpm -s marketbot finance risk AAPL --timeframe 1y --json
pnpm -s marketbot finance fundamentals AAPL --json
pnpm -s marketbot finance news AAPL --limit 10 --json
pnpm -s marketbot finance compare AAPL MSFT NVDA --timeframe 1y --json
pnpm -s marketbot finance brief AAPL --timeframe 6mo --json
pnpm -s marketbot finance dashboard NVDA AAPL --timeframe 6mo --news-limit 3 --json
pnpm -s marketbot finance report NVDA --timeframe 6mo --report-type full
STOCK_LIST="NVDA,AAPL,600519,hk00700" pnpm -s marketbot finance daily --timeframe 6mo --report-type simple --out /tmp/daily.md
pnpm -s marketbot finance portfolio --positions-json '[{"symbol":"AAPL","quantity":10}]' --timeframe 1y --json
pnpm -s marketbot finance optimize AAPL MSFT NVDA --timeframe 1y --json
```

### Symbol Conventions (Yahoo-backed)

- US equities: `AAPL`, `NVDA`
- China A-share: `600519` (auto-normalizes to `600519.SS`), `000001` (auto-normalizes to `000001.SZ`)
- Hong Kong: `hk00700`, `00700`, `700` (auto-normalizes to `00700.HK`)

## Market Analysis (Agent)

`analyze` is an agent wrapper for structured market analysis (with clear assumptions and risk/invalidation).

```bash
pnpm -s marketbot analyze --asset BTC --timeframe 1h --news --json
pnpm -s marketbot analyze --asset NVDA --market equities --style fundamental --news
```

## Browser (Built-In)

```bash
pnpm -s marketbot browser status --json
pnpm -s marketbot browser open https://example.com
pnpm -s marketbot browser snapshot --labels
```

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

## License

MIT. See [LICENSE](LICENSE).
