---
summary: "Generate structured market analysis for a given asset"
read_when:
  - Using MarketBot for market/portfolio analysis from the CLI
---

# analyze

`marketbot analyze` builds a structured market-analysis prompt and runs a single agent turn.
It defaults to the `main` agent when no session target is provided.

## Usage

```
marketbot analyze [options]
```

## Options

- `--asset <symbol>`: Primary asset/symbol (BTC, NVDA, EURUSD, XAUUSD).
- `--market <type>`: Market type (crypto, equities, forex, rates, commodities).
- `--timeframe <tf>`: Timeframe (1h, 4h, 1d, 1w).
- `--risk <level>`: Risk profile (low, medium, high).
- `--style <style>`: Style focus (technical, fundamental, macro, sentiment).
- `--news`: Include recent catalysts/news context.
- `-m, --message <text>`: Custom request (overrides flags above).
- `-t, --to <number>`: Target session by E.164 number.
- `--session-id <id>`: Target an explicit session id.
- `--agent <id>`: Target a specific agent id.
- `--local`: Run the embedded agent locally.
- `--deliver`: Deliver the reply to the configured channel.
- `--json`: Print JSON output.
- `--timeout <seconds>`: Override timeout.

## Examples

```
marketbot analyze --asset BTC --timeframe 1h
marketbot analyze --asset NVDA --market equities --style fundamental --news
marketbot analyze --asset XAUUSD --risk low --json
marketbot analyze --message "Assess EURUSD with FOMC risk and key levels"
```
