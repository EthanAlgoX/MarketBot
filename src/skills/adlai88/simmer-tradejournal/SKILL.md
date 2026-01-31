---
name: simmer-tradejournal
description: Auto-log trades with context, track outcomes, generate calibration reports to improve trading.
metadata: {"clawdbot":{"emoji":"📓","requires":{"env":["SIMMER_API_KEY"]},"cron":"0 0 * * *"}}
authors:
  - Simmer (@simmer_markets)
version: "1.0.0"
---

# Simmer Trade Journal

Track every trade, learn from outcomes, improve your edge.

## When to Use This Skill

Use this skill when the user wants to:
- See their trade history
- Track win rate and P&L
- Generate trading reports
- Analyze which strategies work best

## Quick Commands

```bash
# Sync trades from API
python tradejournal.py --sync

# Show recent trades
python tradejournal.py --history 10

# Generate weekly report
python tradejournal.py --report weekly

# Export to CSV
python tradejournal.py --export trades.csv
```

**API Reference:**
- Base URL: `https://api.simmer.markets`
- Auth: `Authorization: Bearer $SIMMER_API_KEY`
- Trades: `GET /api/sdk/trades`

## How It Works

1. **Sync** - Polls `/api/sdk/trades` to fetch trade history
2. **Store** - Saves trades locally with outcome tracking
3. **Track** - Updates outcomes when markets resolve
4. **Report** - Generates win rate, P&L, and calibration analysis

## CLI Reference

| Command | Description |
|---------|-------------|
| `--sync` | Fetch new trades from API |
| `--history N` | Show last N trades (default: 10) |
| `--sync-outcomes` | Update resolved markets |
| `--report daily/weekly/monthly` | Generate summary report |
| `--config` | Show configuration |
| `--export FILE.csv` | Export to CSV |
| `--dry-run` | Preview without making changes |

## Configuration

| Setting | Environment Variable | Default |
|---------|---------------------|---------|
| API Key | `SIMMER_API_KEY` | (required) |
| API URL | `SIMMER_API_URL` | `https://api.simmer.markets` |

## Storage

Trades are stored locally in `data/trades.json`:

```json
{
  "trades": [{
    "id": "uuid",
    "market_question": "Will X happen?",
    "side": "yes",
    "shares": 10.5,
    "cost": 6.83,
    "outcome": {
      "resolved": false,
      "winning_side": null,
      "pnl_usd": null
    }
  }],
  "metadata": {
    "last_sync": "2025-01-29T...",
    "total_trades": 50
  }
}
```

## Skill Integration

Other skills can enrich trades with context:

```python
from tradejournal import log_trade

# After executing a trade
log_trade(
    trade_id=result['trade_id'],
    source="copytrading",
    thesis="Mirroring whale 0x123...",
    confidence=0.70
)
```

This adds thesis, confidence, and source to the trade record for better analysis.

## Example Report

```
📓 Weekly Report
========================================
Period: Last 7 days
Trades: 15
Total cost: $125.50
Resolved: 8 / 15
Win rate: 62.5%
P&L: +$18.30

By side: 10 YES, 5 NO
```

## Troubleshooting

**"SIMMER_API_KEY environment variable not set"**
- Set your API key: `export SIMMER_API_KEY=sk_live_...`

**"No trades recorded yet"**
- Run `python tradejournal.py --sync` to fetch trades from API

**Trades not showing outcomes**
- Run `python tradejournal.py --sync-outcomes` to update resolved markets
