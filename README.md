<div align="center">
  <img src="marketbot_logo.png" alt="marketbot" width="420">
  <h1>marketbot</h1>
  <p><strong>Skill-first finance analysis assistant with a lightweight agent runtime.</strong></p>
  <p><strong>English | <a href="README_zh.md">中文</a></strong></p>
</div>

`marketbot` evolved from the minimalist general-purpose assistant `nanobot`, but its center of gravity is now financial analysis:

- skill-driven market research instead of a generic prompt wrapper
- finance-native quote/news/macro services instead of tool-specific scraping logic
- explainable output with skill routing, data reliability, source health, and route trace
- chat-first delivery across Telegram, Slack, Discord, Feishu, DingTalk, Email, WhatsApp, QQ, Mochat, and optional Matrix

## What It Is

marketbot is designed for people who want an AI assistant that can both chat and do structured market work:

- generate a market brief for a set of symbols
- monitor watchlists and recurring report tasks
- route requests to the right skills based on market, asset class, freshness, and available tools
- send reports to chat channels with channel-aware formatting
- stay hackable enough that you can read the core code in an afternoon

It keeps the agent flexible, but makes the finance layer explicit.

## Why marketbot

- **Skill-first orchestration**. Skills remain the top-level planning unit. Each skill can declare triggers, output shape, risk level, freshness needs, markets, asset classes, and required tools.
- **Thin runtime**. The runtime focuses on sessions, tool execution, concurrency, cancellation, and channels instead of embedding market logic in the main loop.
- **Finance-native domain layer**. Quote, news, and macro access are backed by shared market domain services with cache, fallback telemetry, and runtime capability profiling.
- **Explainable outputs**. Reports and chat replies can include capability notes, blocked-skill reasons, source health, and reliability summaries.
- **Good operational fit**. The same analysis stack can power CLI usage, scheduled reports, and outbound notifications.

## Architecture

The project is split into four layers:

1. **Runtime**
   - `marketbot/agent/loop.py`
   - `marketbot/agent/processor.py`
   - `marketbot/runtime/bootstrap.py`
   - Handles message ingress, per-session concurrency, session persistence, tool registration, and final outbound messages.

2. **Skills**
   - `marketbot/skills/*/SKILL.md`
   - Encodes higher-level analysis behavior.
   - Skill metadata drives selection using request triggers, market coverage, asset classes, freshness, and runtime tool availability.

3. **Market domain**
   - `marketbot/domain/market/services.py`
   - `marketbot/domain/market/profile.py`
   - Provides normalized market data access, source fallback, route trace, cache, and runtime market capability profiles.

4. **Reporting and delivery**
   - `marketbot/market_reporting.py`
   - `marketbot/channels/*`
   - Turns structured analysis into chat replies, saved reports, and notifications with channel-aware explainability.

## Install

From source:

```bash
git clone https://github.com/EthanAlgoX/MarketBot.git
cd MarketBot
pip install -e .
```

If you need Matrix support:

```bash
pip install -e ".[matrix]"
```

For development:

```bash
pip install -e ".[dev]"
```

## Quick Start

### 1. Initialize workspace and config

```bash
marketbot onboard
```

This creates the default workspace and `~/.marketbot/config.json`.

### 2. Add a model provider

Minimal example:

```json
{
  "providers": {
    "openrouter": {
      "apiKey": "sk-or-v1-xxx"
    }
  },
  "agents": {
    "defaults": {
      "provider": "openrouter",
      "model": "anthropic/claude-opus-4-1"
    }
  },
  "tools": {
    "market": {
      "quoteSource": "yahoo",
      "newsSources": ["reuters", "bloomberg", "cls"],
      "macroSource": "fred",
      "cacheTtlS": 60
    }
  },
  "channels": {
    "explainabilityMode": "auto",
    "explainabilityDelivery": "auto"
  }
}
```

### 3. Use it directly

```bash
marketbot agent
```

### 4. Generate a market brief

```bash
marketbot market report --symbols NVDA,SPY --save
```

Useful options:

- `--json`: return raw structured payload
- `--session auto|premarket|intraday|close`
- `--notify --notify-channel telegram --chat-id 10001`

### 5. Create a recurring report heartbeat

```bash
marketbot market heartbeat-setup
```

## Core Finance Capabilities

Out of the box, the built-in skills focus on a few high-value finance workflows:

| Skill | What it does |
| --- | --- |
| `market-report` | Multi-signal market brief generation for symbols or watchlists |
| `daily-stock-screener` | Daily watchlist screening with valuation, trend, volume, and sentiment filters |
| `market-monitor` | Ongoing watch/monitor style analysis |
| `market-discovery` | Idea generation and market scanning |
| `news-intelligence` | News/event extraction and impact analysis |
| `sentiment-analysis` | News and social sentiment synthesis |
| `portfolio-analyzer` | Portfolio-level review and risk framing |
| `stock-data-sourcing` | Market-specific data sourcing and routing guidance |
| `risk-checklist` | Risk framing around current setups |
| `catalyst-tracker` | Catalyst-oriented research support |

Under those skills, the market toolchain includes:

- `market_snapshot`
- `market_news`
- `market_macro`
- `market_signal`
- `market_brief`
- `market_source_plan`
- `market_event_extract`
- `market_social_sentiment`
- `market_fundamentals`
- `market_chip_distribution`

## Explainability and Reliability

One of the main design goals is to make financial outputs inspectable.

marketbot can expose:

- **skill routing**: which skills were selected and which were blocked
- **blocked reasons**: missing tools, market mismatch, asset-class mismatch, freshness mismatch
- **data reliability**: aggregate status for snapshot/news/macro
- **source health**: per-provider status such as `ok`, `cached`, `fallback`, or `error`
- **route trace**: how the system routed and downgraded data access

These notes appear in:

- chat replies
- saved market reports
- notification summaries
- outbound metadata for channels

Explainability behavior is configurable per channel with:

- `channels.explainabilityMode`
- `channels.explainabilityOverrides`
- `channels.explainabilityDelivery`
- `channels.explainabilityDeliveryOverrides`

## Channels

marketbot supports:

| Channel | Notes |
| --- | --- |
| Telegram | Full bot support via `python-telegram-bot` |
| Slack | Socket mode |
| Discord | REST + gateway flow |
| Feishu | Text, rich post, and card-style output |
| DingTalk | Stream mode |
| Email | IMAP + SMTP |
| WhatsApp | Bridge-based integration |
| QQ | Bot integration |
| Mochat | Socket.IO + HTTP |
| Matrix | Optional extra dependency |

To run as a long-lived multi-channel bot:

```bash
marketbot gateway
```

To inspect current setup:

```bash
marketbot status
marketbot channels --help
marketbot provider --help
```

## Development

### Run tests

Use the project test command below. `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1` is intentional.

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest -p pytest_asyncio.plugin
```

### Useful directories

| Path | Purpose |
| --- | --- |
| `marketbot/agent/` | runtime loop, context, session processing |
| `marketbot/runtime/` | tool bootstrap and runtime wiring |
| `marketbot/domain/market/` | market services, plugins, runtime capability profile |
| `marketbot/skills/` | built-in skills and skill metadata |
| `marketbot/channels/` | chat adapters |
| `marketbot/cache/` | market cache |
| `marketbot/market_reporting.py` | report rendering and explainability output |
| `tests/` | regression coverage |

### Adding a new finance capability

Typical path:

1. add or update a skill in `marketbot/skills/<name>/SKILL.md`
2. declare metadata for triggers, output, risk, freshness, markets, asset classes, and required tools
3. extend market-domain services if you need new normalized data access
4. expose or adapt a tool if the skill needs a new atomic capability
5. add routing, contract, and report tests

## License

MIT
