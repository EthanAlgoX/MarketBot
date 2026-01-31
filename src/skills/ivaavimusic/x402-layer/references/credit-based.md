# Credit-Based Access

For high-frequency or latency-sensitive API calls. Pre-purchase credits, consume instantly.

## Why Use Credits?

- Zero latency (no blockchain wait)
- Zero gas fees per request
- Simple header-based access

## Usage

### Check Balance
```bash
curl "https://api.x402layer.cc/api/credits/balance?endpoint=<slug>" \
  -H "x-wallet-address: 0xYourWallet..."
```

### Consume Endpoint
```bash
curl "https://api.x402layer.cc/e/<slug>" \
  -H "x-wallet-address: 0xYourWallet..." \
  -H "Content-Type: application/json" \
  -d "{\"prompt\": \"your request\"}"
```

### Insufficient Credits Response
When out of credits, you get a 402 with purchase options:

```json
{
  "error": "Insufficient credits",
  "current_balance": 0,
  "purchase_url": "https://studio.x402layer.cc/pay/credits/<slug>",
  "credit_package": {"size": 69, "price": 0.01},
  "accepts": [...]
}
```

## Purchasing Credits

Use the standard 402 flow on the `purchase_url`:

1. GET the purchase URL
2. Parse 402 challenge  
3. Sign EIP-712 payment
4. Send with X-Payment header
5. Credits added to wallet

## Example Python

```python
import requests

def call_with_credits(url, wallet, data):
    resp = requests.post(url, 
        json=data,
        headers={"x-wallet-address": wallet})
    
    if resp.status_code == 402:
        print("Need credits!", resp.json()["purchase_url"])
        return None
    
    return resp.json()
```

## Scripts

- `check_credits.py` - Query balance
- `consume_with_credits.py` - Use credits
- `recharge_credits.py` - Top up via payment

