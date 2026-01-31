# DWLF API Endpoints Reference

Base URL: `https://api.dwlf.co.uk/v2`

## Market Data

### GET /market-data/{symbol}
OHLCV candle data.
- Params: `interval` (1d|4h|1h), `limit` (number)
- Response: `{ candles: [{ date, open, high, low, close, volume, assetId }] }`

### GET /market-data/symbols
List all tracked symbols. Public endpoint.
- Response: `{ symbols: ["NVDA", "TSLA", ...] }`
- Note: Currently only returns stocks/ETFs, not crypto pairs (BUG-006)

### GET /support-resistance/{symbol}
Support and resistance levels with confidence scores.
- Response: `{ support: [{ level, score, count, touches }], resistance: [...], date, startDate, endDate }`
- Note: `endDate` may appear before `startDate` (BUG-005)

### GET /chart-indicators/{symbol}
All computed indicators for a symbol.
- Params: `interval` (1d|4h|1h)
- Response: `{ symbol, indicators: [{ symbol, data: [{ date, value }], startDate, endDate, config }] }`

### GET /trendlines/{symbol}
Auto-detected trendlines.
- Response: `{ trendlines: [{ startDate, endDate, startPrice, endPrice, slope, isActive }] }`

### GET /events
Indicator events (breakouts, crossovers, divergences).
- Params: `symbol`, `type`, `limit`
- Response: `{ events: [{ symbol, eventType, date, confidenceScore, ... }], nextToken }`

## Strategies

### GET /visual-strategies
List user's visual strategies.
- Response: `{ strategies: [{ strategyId, name, description, symbols, createdAt }] }`

### GET /visual-strategies/{strategyId}
Full strategy with signal definitions and graph.
- Response: `{ strategy: { strategyId, name, signals, nodes, edges, ... } }`

### POST /visual-strategies
Create a new visual strategy.
- Body: `{ name, description, symbols, nodes, edges }`

### PUT /visual-strategies/{strategyId}
Update a strategy.
- Body: partial update fields

### GET /visual-strategies/public
List public community strategies. Public endpoint.

## Signals

### GET /user/trade-signals/active
Currently active trade signals.
- Response: `{ signals: [{ symbol, direction, entryPrice, stopLossLevel, strategyDescription, confidenceScore }] }`

### GET /user/trade-signals/recent
Recent signals including completed.
- Params: `limit`
- Response: `{ signals: [...] }`

### GET /user/trade-signals/stats
Signal performance statistics.
- Response: `{ total, active, completed, winRate, avgRR, totalPnL, strategies: {...} }`

### GET /user/trade-signals/symbol/{symbol}
Signals filtered by symbol.

### POST /user/trade-signals/purge
Purge all user signals. Destructive!

## Backtesting

### POST /visual-backtests
Trigger a backtest. Returns immediately, results computed async.
- Body: `{ strategyId, symbol, startDate?, endDate? }`
- Response: `{ backtestId, status: "pending" }`

### GET /visual-backtests/{backtestId}
Get backtest results. Poll until `status: "complete"`.
- Response: `{ backtestId, status, results: { trades, winRate, totalReturn, sharpe, ... } }`

## Portfolio

### GET /portfolios
List user's portfolios.

### GET /portfolios/{portfolioId}
Portfolio with holdings and P&L.

### POST /portfolios
Create a portfolio.
- Body: `{ name, description }`

### GET /portfolios/{portfolioId}/snapshots
Historical portfolio snapshots.

## Trade Journal

### GET /trades
List trades with filters.
- Params: `status` (open|closed), `symbol`, `limit`

### POST /trades
Log a new trade.
- Body: `{ symbol, direction (long|short), entryPrice, stopLoss?, takeProfit?, notes? }`

### PUT /trades/{tradeId}
Update a trade.

### POST /trades/{tradeId}/initial-execution
Record trade execution details.

### GET /trade-plans
List trade plans.

### POST /trade-plans
Create a trade plan.

## Watchlist

### GET /watchlist
User's watchlist symbols.
- Response: `{ watchlist: ["BTC-USD", "NVDA", ...] }`

### POST /watchlist
Add symbol to watchlist.
- Body: `{ symbol: "BTC-USD" }`

### DELETE /watchlist/{symbol}
Remove symbol from watchlist.

## Custom Events

### GET /custom-events
List user's custom events.

### POST /custom-events
Create a custom event definition.
- Body: `{ name, conditions, symbols? }`

### GET /custom-events/{eventId}
Event details and trigger history.

## Custom Event Symbol Activation

Manages which symbols a custom event is active for. Events only fire for activated symbols.

### POST /custom-event-symbols
Activate a single symbol for a custom event.
- Body: `{ eventId: string, symbol: string, config?: object }`
- Response: `{ eventId, symbol, isActive: true, ... }`

### POST /custom-event-symbols/:eventId/enable-all
Bulk activate symbols for a custom event.
- Body: `{ symbols: ["BTC-USD", "ETH-USD", ...] }`
- Response: `{ enabled: number, symbols: [...] }`

### POST /custom-event-symbols/:eventId/disable-all
Bulk deactivate symbols for a custom event.
- Body: `{ symbols: ["BTC-USD", "ETH-USD", ...] }`
- Response: `{ disabled: number, symbols: [...] }`

### GET /custom-event-symbols/event/:eventId
Get active symbols for a specific custom event.
- Response: `{ symbols: [{ symbol, isActive, config?, ... }] }`

### GET /custom-event-symbols
List all user's custom event-symbol associations.
- Params: `activeOnly` (boolean, default false)
- Response: `{ associations: [{ eventId, symbol, isActive, ... }] }`

### PUT /custom-event-symbols/:eventId/:symbol/deactivate
Deactivate a single symbol for an event.
- Response: `{ eventId, symbol, isActive: false }`

### DELETE /custom-event-symbols/:eventId/:symbol
Permanently delete a symbol association for an event.

## Strategy Symbol Activation

Manages which symbols a strategy is active for. Strategies only generate signals for activated symbols.

### POST /strategy-symbols
Activate a single symbol for a strategy.
- Body: `{ strategyId: string, symbol: string, config?: object }`
- Response: `{ strategyId, symbol, isActive: true, ... }`

### POST /strategy-symbols/:strategyId/enable-all
Bulk activate symbols for a strategy.
- Body: `{ symbols: ["BTC-USD", "ETH-USD", ...] }`
- Response: `{ enabled: number, symbols: [...] }`

### POST /strategy-symbols/:strategyId/disable-all
Bulk deactivate symbols for a strategy.
- Body: `{ symbols: ["BTC-USD", "ETH-USD", ...] }`
- Response: `{ disabled: number, symbols: [...] }`

### GET /strategy-symbols/strategy/:strategyId
Get active symbols for a specific strategy.
- Response: `{ symbols: [{ symbol, isActive, config?, ... }] }`

### GET /strategy-symbols
List all user's strategy-symbol associations.
- Params: `activeOnly` (boolean, default false)
- Response: `{ associations: [{ strategyId, symbol, isActive, ... }] }`

### PUT /strategy-symbols/:strategyId/:symbol/deactivate
Deactivate a single symbol for a strategy.
- Response: `{ strategyId, symbol, isActive: false }`

### DELETE /strategy-symbols/:strategyId/:symbol
Permanently delete a symbol association for a strategy.

## Evaluations

### POST /evaluations
Trigger an evaluation run (processes all strategies/events).
- Response: `{ evaluationId }`

### GET /evaluations/{evaluationId}
Get evaluation results.

## Account

### POST /accounts/login
JWT login. Public.
- Body: `{ email, password }`
- Response: `{ token }`

### GET /accounts/api-keys
List API keys (masked).

### POST /accounts/api-keys
Generate a new API key.
- Body: `{ name, scopes: ["read", "write"], expiresAt? }`
- Response: `{ keyId, rawKey, name, scopes }` — rawKey shown ONCE

### DELETE /accounts/api-keys/{keyId}
Revoke an API key.

## Academy (CDN — no auth required)

Base URL: `https://academy.dwlf.co.uk/live`

15 tracks, 60+ lessons covering DWLF concepts — indicators, events, strategies, charting, and more.

| Method | Path | Description |
|--------|------|-------------|
| GET | `https://academy.dwlf.co.uk/live/manifest.json` | List all tracks and lessons |
| GET | `https://academy.dwlf.co.uk/live/lessons/{slug}.md` | Get lesson content (markdown) |

### GET /manifest.json
Full manifest of all tracks and lessons.
- Response: `{ tracks: [{ id, title, description, lessons: [{ slug, title, level, estimatedMinutes }] }] }`

### GET /lessons/{slug}.md
Individual lesson content in markdown format.
- Response: raw markdown text
- Images reference `assets/img/` — prefix with base URL for absolute paths
