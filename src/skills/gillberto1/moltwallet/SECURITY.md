# Moltwallet Security / Threat Model

This is a short, explicit security posture for Moltwallet.

## What Moltwallet does
- Generates a wallet (ed25519)
- Reads balances via Solana RPC
- Buys tokens (Pump/Jupiter path)
- Sends SPL tokens + SOL

## Key handling (critical)
- **Private keys are generated locally** and written to `./wallets/<PUBKEY>.json`.
- Keys are **never sent** to any external service by Moltwallet.
- CLI avoids passing private keys via command-line flags (shell history leaks).
- You are responsible for storing `wallets/` safely and keeping it private.

## Network access
Moltwallet only makes outbound requests to:
- The configured Solana RPC endpoint
- Public swap endpoints used by the buy flow (e.g., Jupiter) when buying tokens

It does **not**:
- Send private keys to any server
- Call home / telemetry endpoints
- Upload wallet files

## Storage
- Wallets are stored in `./wallets/` and **gitignored**.
- If you run Moltwallet in a shared folder, move wallets elsewhere.

## Dependencies
Moltwallet intentionally uses only:
- `@solana/web3.js`
- `@solana/spl-token`

## What Moltwallet is NOT
- Not a custody service
- Not a trading bot with custody
- Not a black box: it’s open source

## Recommended precautions
- Read the code before running
- Use a private RPC if possible
- Keep wallets offline when not in use
- Run on a trusted machine
