# Pay-Per-Request (Direct Mode)

Pay-Per-Request uses the HTTP 402 Payment Required status code to negotiate payment for each individual API call.

## Critical: EIP-712 Signatures

**x402 uses EIP-712 typed data signatures, NOT raw ERC20 transfers.**

The facilitator (CDP) validates and broadcasts the payment. You only need to sign a permit.

---

## Interaction Cycle

### 1. Naïve Request

```bash
curl https://api.x402layer.cc/e/my-endpoint
```

### 2. Parse 402 Challenge

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "base",
      "maxAmountRequired": "10000",
      "payTo": "0xCD95802A4aBddD75A5750DD2d6935007eF268275",
      "asset": "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "extra": {
        "name": "USD Coin",
        "version": "2"
      }
    },
    {
      "scheme": "exact",
      "network": "solana",
      "maxAmountRequired": "10000",
      "payTo": "3rcdSzTam4h5e6UN2USv5L2t9R4Ah466B4mHgxRVEqCx",
      "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "extra": {
        "feePayer": "BENrLoUbndxoNMUS5JXApGMtNykLjFXXixMtpDwDR9SP"
      }
    }
  ]
}
```

### 3. Sign Payment (EIP-712)

```python
import os
import time
import json
import base64
from eth_account import Account
from eth_account.messages import encode_typed_data

def sign_x402_payment(challenge, wallet_address, private_key):
    """Sign x402 payment using EIP-712 (NOT raw ERC20 transfer)"""
    
    # Find Base option
    base_option = next((a for a in challenge["accepts"] if a["network"] == "base"), None)
    if not base_option:
        raise ValueError("No Base payment option")
    
    # Domain from extra field
    extra = base_option.get("extra", {})
    domain = {
        "name": extra.get("name", "USD Coin"),
        "version": extra.get("version", "2"),
        "chainId": 8453,
        "verifyingContract": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    }
    
    # EIP-712 types for TransferWithAuthorization
    types = {
        "TransferWithAuthorization": [
            {"name": "from", "type": "address"},
            {"name": "to", "type": "address"},
            {"name": "value", "type": "uint256"},
            {"name": "validAfter", "type": "uint256"},
            {"name": "validBefore", "type": "uint256"},
            {"name": "nonce", "type": "bytes32"},
        ]
    }
    
    # Message data
    nonce = os.urandom(32)
    message = {
        "from": wallet_address,
        "to": base_option["payTo"],
        "value": int(base_option["maxAmountRequired"]),
        "validAfter": 0,
        "validBefore": int(time.time()) + 3600,
        "nonce": nonce,
    }
    
    # Sign
    encoded = encode_typed_data(domain, types, message)
    signed = Account.sign_message(encoded, private_key)
    
    # Build X-Payment payload
    payment_obj = {
        "x402Version": 1,
        "scheme": "exact",
        "network": "base",
        "payload": {
            "signature": signed.signature.hex(),
            "from": wallet_address,
            "to": base_option["payTo"],
            "value": str(message["value"]),
            "validAfter": str(message["validAfter"]),
            "validBefore": str(message["validBefore"]),
            "nonce": "0x" + nonce.hex(),
        }
    }
    
    return base64.b64encode(json.dumps(payment_obj).encode()).decode()
```

### 4. Authorized Request

```python
import requests

x_payment = sign_x402_payment(challenge, wallet, key)
response = requests.get(url, headers={"X-Payment": x_payment})
print(response.json())
```

---

## Free Endpoints (maxAmountRequired = "0")

Even if amount is 0, you MUST still send a signed payload. This authenticates the caller.

---

## Solana Payments

Solana uses SPL Token transfers (not EIP-712). The transaction must include the `feePayer` from challenge.

```python
from solders.keypair import Keypair
from solders.transaction import Transaction
from solders.pubkey import Pubkey
from spl.token.instructions import transfer_checked
import base64

# Build SPL transfer transaction
# Include feePayer from challenge extra
# Serialize and base64 encode
```

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Invalid signature" | Using raw transfer() | Use EIP-712 signing |
| "Nonce already used" | Replay attack | Generate fresh random nonce |
| "validBefore expired" | Timeout | Set validBefore = now + 3600 |
| "Wrong domain" | Bad name/version | Use "USD Coin" v2 for Base USDC |

