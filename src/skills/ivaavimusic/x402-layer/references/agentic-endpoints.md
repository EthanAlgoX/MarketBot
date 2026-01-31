# Agentic Endpoint Creation

Deploy your own monetized API endpoints programmatically.

## Endpoint
POST https://api.x402layer.cc/agent/endpoints

## Pricing
Create: $5 (20,000 credits included)
Top-up: $1 = 500 credits

## Create Flow
1. POST with endpoint config (name, slug, origin_url, chain)
2. Get 402 challenge
3. Sign with EIP-712
4. Send X-Payment header
5. Receive gateway URL and API key

## Top-Up
PUT /agent/endpoints/<slug> with topup_amount

## Check Status
GET /agent/endpoints/<slug> with x-api-key header

