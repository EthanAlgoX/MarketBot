<div align="center">
  <img src="marketbot_logo.png" alt="marketbot" width="420">
  <h1>marketbot</h1>
  <p><strong>Skill-first finance analysis assistant with a lightweight agent runtime.</strong></p>
  <p><strong>English | <a href="README.md">中文</a></strong></p>
</div>

`marketbot` is an agent runtime built for financial analysis. It keeps the flexibility of a chat agent, but makes the finance layer explicit and inspectable:

- `skills` orchestrate high-level analysis tasks
- shared market-domain services handle `quote / news / macro`
- outputs can include `skill routing`, `data reliability`, `source health`, and `route trace`
- the same stack works across CLI, scheduled jobs, and chat channels

## In One Sentence

If you want something more specific than a generic chatbot, and you need a system that can:

- monitor positions and watchlists
- generate market briefs and catalyst watchlists
- tell you which capabilities it used and how reliable the data was
- run in Feishu, Telegram, Slack, DingTalk, and other channels

that is what this project is for.

## What It Is Good At

- generating market briefs for a symbol set or watchlist
- building catalyst and event watchlists from holdings
- running recurring watchlist monitoring and daily screening
- routing requests to the right skills based on market, asset class, freshness, and runtime tool availability
- sending channel-aware reports with reliability notes
- staying small enough that the core code is still practical to modify

## Why marketbot

- `Skill-first orchestration`
  Financial analysis is not one giant prompt. Skills declare triggers, output shape, risk, freshness, market coverage, asset classes, and required tools.
- `Independent domain layer`
  Quote, news, and macro access live in shared market services instead of being duplicated in every tool.
- `Explainable output`
  Chat replies, reports, and notifications can include skill routing, blocked reasons, source health, and data reliability.
- `Thin runtime`
  The runtime handles sessions, concurrency, tool execution, and channels instead of embedding finance logic in the main loop.
- `Built for iteration`
  The same analysis stack can power CLI usage, saved reports, recurring jobs, and outbound bots.

## Core Concepts

### 1. Skills

`marketbot/skills/*/SKILL.md`

Skills are the top-level orchestration units. They define:

- when they should trigger
- which markets and asset classes they fit
- which tools they depend on
- what kind of output they should produce

Common built-in skills:

| Skill | What it does |
| --- | --- |
| `market-report` | Structured market briefs for symbols or watchlists |
| `market-monitor` | Ongoing monitoring and market surveillance |
| `market-discovery` | Theme and idea discovery |
| `news-intelligence` | News clustering and impact analysis |
| `sentiment-analysis` | News and social sentiment synthesis |
| `portfolio-analyzer` | Portfolio-level risk and structure review |
| `daily-stock-screener` | Daily watchlist screening across valuation, trend, volume, and sentiment |
| `catalyst-tracker` | Event and catalyst tracking |
| `stock-watch` | Monitoring and summaries for specific symbols |
| `risk-checklist` | Risk framing around active setups |

### 2. Market Domain

`marketbot/domain/market/`

This is the standardized market-data layer. It is responsible for:

- quote routing
- news routing
- macro access
- cache
- source health
- route trace
- runtime capability profiles

The goal is not to always produce an answer. The goal is to return real data when available, and be explicit when it is not.

### 3. Tools

The main market tools are:

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

### 4. Reporting and Delivery

`marketbot/market_reporting.py` and `marketbot/channels/*`

These turn structured analysis into:

- CLI replies
- saved reports
- notification summaries
- channel messages

## 5-Minute Quick Start

### 1. Install

```bash
git clone https://github.com/EthanAlgoX/MarketBot.git
cd MarketBot
pip install -e .
```

If you need Matrix:

```bash
pip install -e ".[matrix]"
```

For development:

```bash
pip install -e ".[dev]"
```

### 2. Initialize config

```bash
marketbot onboard
```

This creates the default workspace and `~/.marketbot/config.json`.

### 3. Configure a model provider and market tools

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
      "quoteSource": "auto",
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

Notes:

- `quoteSource: auto` is the safest default for mixed-market workflows
- `newsSources` controls the news routing order
- `macroSource: fred` requires a FRED API key; without one, the system should degrade explicitly
- `explainabilityMode` controls whether capability and reliability notes are attached

### 4. Start using it

Open chat mode:

```bash
marketbot agent
```

Ask for prices:

```bash
marketbot agent -m "Give me the latest price for NVDA, 07709, and 513310"
```

Generate a holdings-driven event watchlist:

```bash
marketbot agent -m "Build a two-week catalyst watchlist for NVDA, UNH, 07709, 07747, 513310, and 518880"
```

Generate a market brief:

```bash
marketbot market report --symbols NVDA,SPY --save
```

Useful options:

- `--json`: return the raw structured payload
- `--session auto|premarket|intraday|close`
- `--notify --notify-channel telegram --chat-id 10001`

Create a recurring heartbeat template:

```bash
marketbot market heartbeat-setup
```

## Common Workflows

### Holdings / watchlist monitoring

```bash
marketbot agent -m "Generate today's premarket watchlist for SPY,NVDA,GOOG,TSLA,UNH,07709,513310"
```

### Catalyst and event tracking

```bash
marketbot agent -m "List the most important catalysts and risks for NVDA, UNH, and 07709 over the next two weeks"
```

### Daily screening

```bash
marketbot agent -m "Screen NVDA,TSLA,INTC,TTD,CRWV and rank today's best setups"
```

### Data-source and routing diagnostics

```bash
marketbot agent -m "Why does 07709 use this quote source? Show me the routing and reliability."
```

## Explainability and Reliability

This is the part that most clearly separates `marketbot` from a generic chat agent.

The system can expose:

- `skill routing`
  which skills were selected
- `blocked reasons`
  which skills were not selected, and why
- `data reliability`
  aggregate status for `snapshot / news / macro`
- `source health`
  per-provider state such as `ok`, `cached`, `degraded`, `fallback`, or `error`
- `route trace`
  how data access was routed and downgraded

These notes can appear in:

- chat replies
- saved market reports
- notification summaries
- outbound metadata

Per-channel configuration:

- `channels.explainabilityMode`
- `channels.explainabilityOverrides`
- `channels.explainabilityDelivery`
- `channels.explainabilityDeliveryOverrides`

## Channels

Supported channels:

| Channel | Notes |
| --- | --- |
| Telegram | via `python-telegram-bot` |
| Slack | Socket mode |
| Discord | REST + gateway |
| Feishu | text, post, and card-style output |
| DingTalk | Stream mode |
| Email | IMAP + SMTP |
| WhatsApp | bridge-based integration |
| QQ | bot integration |
| Mochat | Socket.IO + HTTP |
| Matrix | optional extra dependency |

Run as a long-lived bot:

```bash
marketbot gateway
```

Inspect the current setup:

```bash
marketbot status
marketbot channels --help
marketbot provider --help
marketbot skills --help
```

## Browser Integration

If you want `bb-browser` integration, start with a conservative configuration:

```json
{
  "tools": {
    "browser": {
      "enabled": true,
      "command": "bb-browser",
      "mode": "safe",
      "allowSites": ["xueqiu", "eastmoney", "reddit", "github", "youtube"],
      "allowDomains": ["xueqiu.com", "eastmoney.com", "reddit.com", "github.com", "youtube.com"],
      "allowUrlPrefixes": ["https://www.youtube.com/watch?v=", "https://api.github.com/repos/"],
      "allowRequestCapture": false,
      "allowRequestBodies": false
    }
  }
}
```

Notes:

- `safe` allows read-only browser operations
- `allowSites` / `allowAdapters` constrain `browser_site`
- `allowDomains` / `allowUrlPrefixes` constrain page open and network fetch
- `allowRequestCapture` and `allowRequestBodies` should stay off unless explicitly needed

## Skill Search and Install

Search local skills first, then fall back to curated external catalogs:

```bash
marketbot skills search "kubernetes deployment"
marketbot skills install k8s-release
```

Installed external skills are written to `workspace/skills/` and loaded as workspace skills in the next session.

## Development

### Useful directories

| Path | Purpose |
| --- | --- |
| `marketbot/agent/` | runtime loop, context, session processing |
| `marketbot/runtime/` | tool bootstrap and runtime wiring |
| `marketbot/domain/market/` | market services and runtime capability profiles |
| `marketbot/skills/` | built-in skills and metadata |
| `marketbot/channels/` | channel adapters |
| `marketbot/cache/` | market cache |
| `marketbot/market_reporting.py` | report rendering and explainability output |
| `tests/` | regression coverage |

### Run tests

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest -p pytest_asyncio.plugin
```

### Typical path for adding a new finance capability

1. add or update a skill in `marketbot/skills/<name>/SKILL.md`
2. declare metadata for triggers, output, risk, freshness, markets, asset classes, and required tools
3. extend `marketbot/domain/market/` if you need new normalized data access
4. expose or adapt a tool if the skill needs a new atomic capability
5. add routing, contract, and report tests

## License

MIT
