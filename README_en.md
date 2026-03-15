<div align="center">
  <img src="marketbot_logo.png" alt="marketbot" width="420">
  <h1>marketbot</h1>
  <p><strong>Skill-first finance analysis assistant with a lightweight agent runtime.</strong></p>
  <p><strong>English | <a href="README.md">中文</a></strong></p>
</div>

`marketbot` is an agent runtime built for financial analysis. It keeps the flexibility of a chat agent, but makes the finance layer explicit and maintainable:

- `skills` orchestrate high-level analysis tasks
- shared market-domain services handle `quote / news / macro`
- outputs can include `skill routing`, `data reliability`, `source health`, and `route trace`
- the same stack works across CLI, scheduled jobs, and chat channels

## What You Can Use It For

- generating market briefs for a symbol set or watchlist
- building catalyst and event watchlists from holdings
- running recurring watchlist monitoring and daily screening
- routing requests to the right skills based on market, asset class, freshness, and runtime tool availability
- sending channel-aware reports with reliability notes
- staying small enough that the core code is still practical to modify

## Why It Is Not Just Another Chatbot

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

## Shortest Path To First Use

```bash
marketbot onboard
marketbot agent
marketbot agent -m "Give me the latest price for NVDA, 07709, and 513310"
marketbot agent -m "Build a two-week catalyst watchlist for NVDA, UNH, 07709, 07747, 513310, and 518880"
```

## Core Concepts

| Layer | Location | Responsibility |
| --- | --- | --- |
| `Skills` | `marketbot/skills/*/SKILL.md` | High-level orchestration: when to trigger, which market fits, which tools are required, and what output shape to use |
| `Market Domain` | `marketbot/domain/market/` | Standardized `quote / news / macro` access plus cache, source health, route trace, and runtime capability profiles |
| `Tools` | `marketbot/agent/tools/market.py` and related modules | Atomic capabilities such as `market_snapshot`, `market_news`, `market_macro`, and `market_brief` |
| `Reporting / Delivery` | `marketbot/market_reporting.py`, `marketbot/channels/*` | Render structured analysis into CLI replies, saved reports, notification summaries, and channel messages |

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

The 4 commands most people need first:

```bash
marketbot agent
marketbot agent -m "Give me the latest price for NVDA, 07709, and 513310"
marketbot agent -m "Build a two-week catalyst watchlist for NVDA, UNH, 07709, 07747, 513310, and 518880"
marketbot market report --symbols NVDA,SPY --save
```

Also useful:

- `marketbot market report --json`: return the raw structured payload
- `marketbot market report --session premarket|intraday|close`
- `marketbot market report --notify --notify-channel telegram --chat-id 10001`
- `marketbot market heartbeat-setup`: create a recurring heartbeat template

## Common Workflows

```bash
marketbot agent -m "Generate today's premarket watchlist for SPY,NVDA,GOOG,TSLA,UNH,07709,513310"
marketbot agent -m "List the most important catalysts and risks for NVDA, UNH, and 07709 over the next two weeks"
marketbot agent -m "Screen NVDA,TSLA,INTC,TTD,CRWV and rank today's best setups"
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
