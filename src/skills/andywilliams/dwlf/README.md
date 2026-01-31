# 📊 DWLF Clawdbot Skill

A [Clawdbot](https://github.com/clawdbot/clawdbot) skill that gives your agent native access to [DWLF](https://dwlf.co.uk) — a market analysis platform for crypto and stocks.

Ask your agent things like:
- "How's BTC looking?"
- "What signals fired today?"
- "Show me support/resistance levels for TSLA"
- "Run a backtest on my Golden Cross strategy"
- "Log a long on ETH at 3,200"
- "Create a custom event that fires when DSS exits oversold with a bullish cross"
- "Search the academy for lessons about composability"

## What's DWLF?

DWLF turns market noise into semantic data — support/resistance levels, indicator events, trade signals, backtests, and more. This skill lets your Clawdbot agent tap into all of it conversationally.

The companion [MCP server](https://github.com/dwlf-ai/dwlf-mcp-server) exposes 43 tools across market data, indicators, strategies, backtesting, portfolio, trade journal, custom events, AI summaries, and academy content.

## Setup

### 1. Install the skill

Copy this skill into your Clawdbot workspace:

```bash
cd ~/clawd/skills
git clone https://github.com/andywilliams/dwlf-clawdbot-skill.git dwlf
```

### 2. Get an API key

1. Sign up at [dwlf.co.uk](https://dwlf.co.uk)
2. Go to **Settings → API Keys**
3. Click **Generate Key** — name it something like "Clawdbot"
4. Copy the key (`dwlf_sk_...`)

### 3. Configure auth

Add your API key to `TOOLS.md` in your workspace:

```markdown
## DWLF
- API Key: dwlf_sk_your_key_here
```

Or set the environment variable:

```bash
export DWLF_API_KEY="dwlf_sk_your_key_here"
```

### 4. Use it

Just talk to your agent about markets. The skill triggers automatically on topics like market analysis, trading signals, backtests, portfolio, indicators, support/resistance, etc.

## What's Included

```
dwlf/
├── SKILL.md              # Procedural instructions (loaded by Clawdbot)
├── scripts/
│   └── dwlf-api.sh      # Generic API wrapper (curl + jq)
└── references/
    └── api-endpoints.md  # Full endpoint reference (188+ endpoints)
```

## Capabilities

| Feature | Examples |
|---------|---------|
| **Market Data** | Price, OHLCV candles, volume |
| **Technical Indicators** | RSI, EMA, MACD, Bollinger Bands, DSS, Ichimoku, and more |
| **Support/Resistance** | Auto-detected levels with confidence scores |
| **Trendlines** | Auto-detected with slope and touch points |
| **Events** | Breakouts, crossovers, divergences, candlestick patterns |
| **Strategies** | Create, view, compile, and manage visual signal strategies |
| **Backtesting** | Run backtests with win rate, Sharpe ratio, P&L |
| **Trade Signals** | Active signals, recent history, performance stats |
| **Portfolio** | Track holdings, P&L, snapshots |
| **Trade Journal** | Log trades, add notes, track executions |
| **Watchlist** | Monitor symbols |
| **Custom Events** | Define your own indicator-based events with composable gates |
| **AI Summaries** | Dashboard overview, symbol briefs, strategy performance — optimized for agents |
| **Academy** | Educational content on indicators, events, strategies, and composability |

## Example Prompts

```
# Market analysis
"How's BTC looking?"
"What are the support and resistance levels for TSLA?"
"Show me RSI, MACD, and DSS for NVDA on the 4h chart"
"What events have fired for SOL recently?"

# Signals & strategies
"What signals fired today?"
"How are my strategies performing? Show win rates"
"Browse public strategies for ideas"

# Strategy building & backtesting
"Create a Golden Cross strategy using EMA 50/200"
"Backtest my Trend Momentum strategy on NVDA"
"What's the Sharpe ratio on my last backtest?"

# Portfolio & trades
"Show me my portfolio performance"
"Log a long on ETH at 3,200 with a stop at 3,050"
"Add a note to my BTC trade: held through consolidation"
"Close my TSLA trade at 285"

# Custom events
"Create a custom event that fires when DSS exits oversold with a bullish cross"
"List my custom events and their recent triggers"

# Academy
"What does the academy say about composability?"
"Show me the lesson on custom events"
"Search the academy for lessons about DSS"
```

## Cookbook

Multi-step workflows the agent handles naturally:

### Analyze a Symbol
Ask "Give me a full analysis of BTC" and the agent will:
1. Pull the AI symbol brief (price, indicators, S/R, events)
2. Get 4h indicators for momentum detail
3. Check trendlines and support/resistance
4. Review recent events and active signals
5. Synthesize everything into a market view

### Build and Backtest a Strategy
Ask "Create a trend-following strategy and test it on BTC" and the agent will:
1. Create the strategy with your conditions
2. Compile it into executable form
3. Run a backtest over your chosen period
4. Review results (win rate, Sharpe, P&L)
5. Suggest iterations based on the numbers

### Daily Trading Routine
Ask "What's going on today?" and the agent will:
1. Pull the AI dashboard (watchlist, signals, trades, portfolios)
2. Highlight active signals and their performance
3. Review open positions
4. Help you log new trades or journal existing ones

For detailed worked examples with tool call sequences, see the [MCP server cookbook](https://github.com/dwlf-ai/dwlf-mcp-server/blob/main/docs/cookbook.md).

## Symbol Format

- **Crypto:** `BTC-USD`, `ETH-USD`, `SOL-USD`
- **Stocks/ETFs:** `TSLA`, `NVDA`, `META`, `MARA`
- **Forex:** `GBP-USD`, `EUR-USD`

## Also Available: MCP Server

Want to use DWLF from Claude Desktop, Codex, Cursor, or any MCP client? Check out the companion project:

👉 [dwlf-mcp-server](https://github.com/dwlf-ai/dwlf-mcp-server) — 43 tools, full read/write access

## License

MIT
