# Payment Signing Reference

## Critical Understanding

x402 uses EIP-712 typed data signatures for TransferWithAuthorization. The CDP facilitator verifies the signature and broadcasts the actual on-chain transaction.

## Base (EVM) - EIP-712 Signing

### Domain (Base USDC)
```python
domain = {
    "name": "USD Coin",
    "version": "2",
    "chainId": 8453,
    "verifyingContract": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
}
```

### Types
```python
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
```

### Signing
```python
from eth_account import Account
from eth_account.messages import encode_typed_data
import os, time

message = {
    "from": wallet,
    "to": challenge["payTo"],
    "value": int(challenge["maxAmountRequired"]),
    "validAfter": 0,
    "validBefore": int(time.time()) + 3600,
    "nonce": os.urandom(32),
}

encoded = encode_typed_data(domain, types, message)
signed = Account.sign_message(encoded, private_key)
```

## Solana - SPL Transfer

Solana uses SPL Token transfers with base64 encoding.

## X-Payment Header Format

Base64 encode the payment JSON:
```python
import json, base64
x_payment = base64.b64encode(json.dumps(payload).encode()).decode()
```

