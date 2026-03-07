---
name: crypto-gold-monitor
description: Monitor BTC, ETH, gold, and silver from free APIs with no key required.
metadata: {"marketbot":{"emoji":"🪙","requires":{"bins":["bash","curl","python3"]}}}
---

# Crypto & Gold Monitor

Monitor Bitcoin, Ethereum, gold, silver, and USD/CNY with free data sources.

## When to use

- User wants a quick macro risk pulse across crypto and metals.
- You need a lightweight commodity and crypto dashboard.
- You want a no-key fallback while richer data feeds are unavailable.

## Script location

This skill ships with a helper script next to this file:

```bash
bash marketbot/skills/crypto-gold-monitor/crypto-monitor.sh
```

If `marketbot` is installed as a package, resolve the script relative to the `SKILL.md` location before running it.

## Usage

### View all prices

```bash
bash marketbot/skills/crypto-gold-monitor/crypto-monitor.sh all
```

### Force refresh

```bash
bash marketbot/skills/crypto-gold-monitor/crypto-monitor.sh refresh
```

### Manually update metal anchors

```bash
bash marketbot/skills/crypto-gold-monitor/crypto-monitor.sh update 2680 31.50
```

## Data sources

- CoinGecko
- ExchangeRate API
- GoldAPI demo endpoint
- Yahoo Finance fallback

## Notes

- This is a monitoring skill, not a trading signal by itself.
- Treat metals output as indicative when fallback estimation is used.
