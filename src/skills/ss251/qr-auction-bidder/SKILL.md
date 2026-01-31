---
name: qr-auction-bidder
description: Bid on $QR auctions at qrcoin.fun. Place bids on Base mainnet using USDC. Uses Bankr for transaction execution — no wallet management needed.
metadata:
  openclaw:
    emoji: "🎯"
    requires: []
---

# QR Auction Bidder

Bid on $QR daily auctions. Each auction lets you bid with USDC to win a QR code that points to your chosen URL for 24 hours.

## Overview

$QR runs continuous 24-hour auctions on Base mainnet. The highest bid wins, and the winning URL is displayed on a real QR code. Losing bidders are refunded automatically.

- **Website**: https://qrcoin.fun
- **Network**: Base mainnet (chain ID 8453)
- **Currency**: USDC (6 decimals)
- **Community**: m/qr on moltbook.com
- **Transaction execution**: Uses [Bankr](https://bankr.bot) — install the `bankr` skill from https://github.com/BankrBot/moltbot-skills

## Contract Addresses

| Contract | Address |
|----------|---------|
| QRAuctionV5 | `0x7309779122069EFa06ef71a45AE0DB55A259A176` |
| USDC (Base) | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

## Minimum Bids

| Action | Minimum |
|--------|---------|
| Create new bid (`createBid`) | 11.11 USDC |
| Contribute to existing bid (`contributeToBid`) | 1.00 USDC |

## How Auctions Work

1. A new auction starts automatically after the previous one settles
2. Each auction has a `tokenId`, `startTime`, and `endTime` (typically 24 hours)
3. Bidders call `createBid()` to bid on a URL, or `contributeToBid()` to add USDC to an existing URL's bid
4. The highest total bid when time expires wins
5. If the leading URL changes in the last 5 minutes, the auction extends by 5 more minutes (up to 3 hours max beyond the scheduled end). Note: contributing to the already-winning URL does NOT trigger an extension.
6. After the auction ends, it's settled and losing bidders are refunded

## Prerequisites

This skill uses **Bankr** for on-chain transaction execution. Install the bankr skill first:

```
https://github.com/BankrBot/moltbot-skills
```

Bankr handles wallet creation, USDC approvals, transaction signing, gas estimation, and confirmation. No private keys or wallet setup needed.

## Check Auction Status

Query the current auction state via RPC:

```bash
# Get current auction state (tokenId, highestBid, startTime, endTime, settled)
curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"0x7309779122069EFa06ef71a45AE0DB55A259A176","data":"0xe4b8f0de"},"latest"],"id":1}' \
  | jq -r '.result'
```

The `auction()` function (selector `0xe4b8f0de`) returns the full auction state including `tokenId`, `highestBid`, `startTime`, `endTime`, `settled`, and `qrMetadata`.

```bash
# Get number of bids in current auction
curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"0x7309779122069EFa06ef71a45AE0DB55A259A176","data":"0x91a3823f"},"latest"],"id":1}' \
  | jq -r '.result' | xargs printf "%d\n"
```

```bash
# Get create bid reserve price (should return 11110000 = 11.11 USDC)
curl -s -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"0x7309779122069EFa06ef71a45AE0DB55A259A176","data":"0x4b6014f6"},"latest"],"id":1}' \
  | jq -r '.result' | xargs printf "%d\n"
```

## Bidding with Bankr

### Step 1: Approve USDC

Before bidding, approve the auction contract to spend your USDC. The contract takes your full allowance (up to your balance) as the bid amount, so set approval to exactly what you want to bid.

```
Approve 15 USDC to 0x7309779122069EFa06ef71a45AE0DB55A259A176 on Base
```

Or via Bankr script:
```bash
scripts/bankr.sh "Approve 15 USDC to 0x7309779122069EFa06ef71a45AE0DB55A259A176 on Base"
```

### Step 2: Create a New Bid

Use `createBid` when no bid exists yet for your URL. Always query the current `tokenId` from `auction()` first.

**Function**: `createBid(uint256 _tokenId, string _urlString, string _name)`

```
Send transaction to 0x7309779122069EFa06ef71a45AE0DB55A259A176 on Base calling createBid(329, "https://your-url.com", "YourName")
```

Or via Bankr script:
```bash
scripts/bankr.sh 'Send transaction to 0x7309779122069EFa06ef71a45AE0DB55A259A176 on Base calling createBid(329, "https://your-url.com", "YourName")'
```

> **Important**: Replace `329` with the actual current `tokenId`. Using a wrong token ID reverts with `INVALID_TOKEN_ID`.

### Step 3: Contribute to an Existing Bid

Use `contributeToBid` to add USDC to a URL that already has a bid:

**Function**: `contributeToBid(uint256 _tokenId, string _urlString, string _name)`

```
Send transaction to 0x7309779122069EFa06ef71a45AE0DB55A259A176 on Base calling contributeToBid(329, "https://existing-url.com", "YourName")
```

Or via Bankr script:
```bash
scripts/bankr.sh 'Send transaction to 0x7309779122069EFa06ef71a45AE0DB55A259A176 on Base calling contributeToBid(329, "https://existing-url.com", "YourName")'
```

### Decide: createBid vs contributeToBid

- If your URL has **no existing bid** → use `createBid` (minimum 11.11 USDC)
- If your URL **already has a bid** → use `contributeToBid` (minimum 1.00 USDC)
- Calling `createBid` with a URL that already has a bid reverts with `URL_ALREADY_HAS_BID`
- Calling `contributeToBid` with a URL that has no bid reverts with `BID_NOT_FOUND`

## Auction Timing

| Parameter | Value |
|-----------|-------|
| Duration | 24 hours |
| Time buffer | 5 minutes (a new leading URL in the last 5 min extends the auction) |
| Max extension | 3 hours beyond scheduled end |

## Important Notes

- **USDC is real money.** Bids use real USDC on Base mainnet. Only bid what you can afford to lose.
- **Losing bids are refunded** after the auction settles, but there may be a delay during batch processing.
- **The contract takes your full allowance** (up to your balance). Set your USDC approval to exactly your intended bid amount.
- **URL must be unique per auction.** If someone already bid on your URL, use `contributeToBid`. Calling `createBid` with a taken URL will revert with `URL_ALREADY_HAS_BID`.
- **Token ID must match.** Always read the current `tokenId` from `auction()` before bidding. Using a wrong token ID reverts with `INVALID_TOKEN_ID`.

## Error Codes

| Error | Meaning | Solution |
|-------|---------|----------|
| `INVALID_TOKEN_ID` | Wrong auction token ID | Query `auction()` for current tokenId |
| `AUCTION_OVER` | Auction has ended | Wait for next auction |
| `RESERVE_PRICE_NOT_MET` | Bid below minimum | Approve at least 11.11 USDC (create) or 1.00 USDC (contribute) |
| `URL_ALREADY_HAS_BID` | URL already bid on | Use `contributeToBid` instead |
| `BID_NOT_FOUND` | No existing bid for URL | Use `createBid` instead |
| `AUCTION_SETTLED` | Auction already settled | Wait for next auction |

## ABI Reference

The full QRAuctionV5 ABI is available at `references/QRAuctionV5.abi.json` in this skill package.

Key functions:

| Function | Description |
|----------|-------------|
| `auction()` | Get current auction state (tokenId, highestBid, startTime, endTime, settled) |
| `getAllBids()` | Get all bids for current auction |
| `getBid(url)` | Get bid for a specific URL |
| `getBidCount()` | Number of bids in current auction |
| `createBid(tokenId, url, name)` | Place a new bid for a URL |
| `contributeToBid(tokenId, url, name)` | Add to an existing URL's bid |
| `createBidReservePrice()` | Get minimum for new bids |
| `contributeBidReservePrice()` | Get minimum for contributions |

Key events:

| Event | Description |
|-------|-------------|
| `AuctionBid` | New bid created |
| `BidContributionMade` | Contribution added to existing bid |
| `AuctionSettled` | Auction ended, winner determined |
| `AuctionCreated` | New auction started |

## Typical Workflow

1. **Check auction status** — Query `auction()` for current tokenId and time remaining
2. **Check existing bids** — Query `getAllBids()` or `getBid(url)` to see what's already bid
3. **Approve USDC via Bankr** — Set allowance to exactly your intended bid amount
4. **Place bid via Bankr** — `createBid` for a new URL or `contributeToBid` for an existing one
5. **Monitor** — Watch for outbids and contribute more if needed
6. **Settlement** — Losing bids are refunded automatically after the auction settles

## Links

- **Platform**: https://qrcoin.fun
- **About / Docs**: https://qrcoin.fun/about
- **Auction Contract**: https://basescan.org/address/0x7309779122069EFa06ef71a45AE0DB55A259A176
- **Bankr skill**: https://github.com/BankrBot/moltbot-skills
- **Community**: m/qr on moltbook.com
