---
name: x402-layer
version: 1.0.1
description: |
  x402 Singularity Layer - Enable AI agents to deploy monetized API endpoints,
  consume paid services via USDC payments, manage credits, and participate
  in a self-sustaining agent economy. Supports Base and Solana networks.
metadata:
  clawdbot:
    emoji: "⚡"
    os:
      - linux
      - darwin
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - WebFetch
---

# x402 Singularity Layer

x402 is a **Web3 payment layer** enabling AI agents to:
- 💰 **Pay** for API access using USDC
- 🚀 **Deploy** monetized endpoints
- 🔍 **Discover** services via marketplace
- 📊 **Manage** endpoints and credits

**Networks:** Base (EVM) • Solana  
**Currency:** USDC  
**Protocol:** HTTP 402 Payment Required

---

## Quick Start

### 1. Install Dependencies
```bash
pip install -r {baseDir}/requirements.txt
```

### 2. Set Up Wallet
```bash
# For Base (EVM)
export PRIVATE_KEY="0x..."
export WALLET_ADDRESS="0x..."

# For Solana (optional)
export SOLANA_SECRET_KEY="[1,2,3,...]"  # JSON array
```

---

## Scripts Overview

### 🛒 CONSUMER MODE (Buying Services)

| Script | Purpose |
|--------|---------|
| `pay_base.py` | Pay for endpoint on Base network |
| `pay_solana.py` | Pay for endpoint on Solana network |
| `consume_credits.py` | Use pre-purchased credits (fast) |
| `consume_product.py` | Purchase digital products (files) |
| `check_credits.py` | Check your credit balance |
| `recharge_credits.py` | Buy credit packs for an endpoint |
| `discover_marketplace.py` | Browse available services |

### 🏭 PROVIDER MODE (Selling Services)

| Script | Purpose |
|--------|---------|
| `create_endpoint.py` | Deploy new monetized endpoint ($5) |
| `manage_endpoint.py` | View/update your endpoints |
| `topup_endpoint.py` | Add credits to YOUR endpoint |
| `list_on_marketplace.py` | Publish endpoint publicly |

---

## Consumer Flows

### A. Pay-Per-Request (Recommended)

```bash
# Pay with Base (EVM) - 100% reliable
python {baseDir}/scripts/pay_base.py https://api.x402layer.cc/e/weather-data

# Pay with Solana - includes retry logic
python {baseDir}/scripts/pay_solana.py https://api.x402layer.cc/e/weather-data
```

### B. Credit-Based Access (Fastest)

Pre-purchase credits for instant access without blockchain latency:

```bash
# Check your balance
python {baseDir}/scripts/check_credits.py weather-data

# Buy credits (consumer purchasing credits)
python {baseDir}/scripts/recharge_credits.py weather-data pack_100

# Use credits for instant access
python {baseDir}/scripts/consume_credits.py https://api.x402layer.cc/e/weather-data
```

### C. Discover Services

```bash
# Browse all services
python {baseDir}/scripts/discover_marketplace.py

# Search by keyword
python {baseDir}/scripts/discover_marketplace.py search weather
```

---

## Provider Flows

### A. Create Endpoint ($5 one-time)

Deploy your own monetized API:

```bash
python {baseDir}/scripts/create_endpoint.py my-api "My AI Service" https://api.example.com 0.01
```

Includes 20,000 test credits.

### B. Manage Your Endpoint

```bash
# List your endpoints
python {baseDir}/scripts/manage_endpoint.py list

# View stats
python {baseDir}/scripts/manage_endpoint.py stats my-api

# Update price
python {baseDir}/scripts/manage_endpoint.py update my-api --price 0.02
```

### C. Top Up YOUR Endpoint (Provider)

Add credits to maintain your endpoint's balance:

```bash
python {baseDir}/scripts/topup_endpoint.py my-api 10  # Add $10 worth
```

> Note: This is different from `recharge_credits.py` which is for CONSUMERS.

### D. List on Marketplace

Make your endpoint publicly discoverable:

```bash
python {baseDir}/scripts/list_on_marketplace.py my-api --category ai --description "AI-powered analysis"
```

---

## Payment Technical Details

### Base (EVM) - EIP-712 Signatures

Uses USDC `TransferWithAuthorization` (EIP-3009):
- Gasless for payer
- Facilitator settles on-chain
- 100% reliable

### Solana - Versioned Transactions

Uses `VersionedTransaction` with `MessageV0`:
- Facilitator pays gas (from `extra.feePayer`)
- SPL Token `TransferChecked` instruction
- ~75% success rate (retry logic included)

---

## Environment Reference

| Variable | Required For | Description |
|----------|--------------|-------------|
| `PRIVATE_KEY` | Base payments | EVM private key (0x...) |
| `WALLET_ADDRESS` | All operations | Your wallet address |
| `SOLANA_SECRET_KEY` | Solana payments | JSON array of bytes |

---

## API Base URL

- **Endpoints:** `https://api.x402layer.cc/e/{slug}`
- **Marketplace:** `https://api.x402layer.cc/api/marketplace`
- **Credits:** `https://api.x402layer.cc/api/credits/*`
- **Agent API:** `https://api.x402layer.cc/agent/*`

---

## Resources

- 📖 **Documentation:** [studio.x402layer.cc/docs/agentic-access/openclaw-skill](https://studio.x402layer.cc/docs/agentic-access/openclaw-skill)
- 💻 **GitHub Docs:** [github.com/ivaavimusic/SGL_DOCS_2025](https://github.com/ivaavimusic/SGL_DOCS_2025)
- 🐦 **OpenClaw:** [x.com/openclaw](https://x.com/openclaw)
- 🌐 **x402 Studio:** [studio.x402layer.cc](https://studio.x402layer.cc)

---

## Known Issues

⚠️ **Solana payments** have ~75% success rate due to facilitator-side fee payer infrastructure issue. Retry logic is included in `pay_solana.py`. **Base (EVM) payments are 100% reliable** and recommended for production.
