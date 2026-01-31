#!/usr/bin/env python3
"""
x402 Endpoint Credit Topup (SELLER/PROVIDER)

Add credits to YOUR OWN agentic endpoint to maintain balance.
This is for endpoint OWNERS, not consumers.

For CONSUMER credit purchases, use recharge_credits.py instead.

Usage:
    python topup_endpoint.py <your_endpoint_slug> <amount_usd>
    
Example:
    python topup_endpoint.py my-weather-api 10  # Add $10 worth of credits
    
Environment Variables:
    PRIVATE_KEY - Your EVM private key (0x...) - must be endpoint owner
    WALLET_ADDRESS - Your wallet address (0x...) - must be endpoint owner
"""

import os
import sys
import json
import time
import base64
import secrets
import requests
from eth_account import Account

API_BASE = "https://api.x402layer.cc"
USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
USDC_NAME = "USD Coin"
USDC_VERSION = "2"

def load_credentials():
    """Load wallet credentials from environment."""
    private_key = os.getenv("PRIVATE_KEY")
    wallet = os.getenv("WALLET_ADDRESS")
    if not private_key or not wallet:
        try:
            from dotenv import load_dotenv
            load_dotenv()
            private_key = os.getenv("PRIVATE_KEY")
            wallet = os.getenv("WALLET_ADDRESS")
        except ImportError:
            pass
    
    if not private_key or not wallet:
        print("Error: Set PRIVATE_KEY and WALLET_ADDRESS environment variables")
        sys.exit(1)
    return private_key, wallet

def topup_endpoint(endpoint_slug: str, amount_usd: float) -> dict:
    """
    Add credits to your own endpoint.
    
    This is a SELLER/PROVIDER operation - you must own the endpoint.
    Credits allow consumers to access your endpoint faster.
    
    Args:
        endpoint_slug: Your endpoint's slug
        amount_usd: Amount in USD to add as credits
    
    Returns:
        Transaction result
    """
    private_key, wallet = load_credentials()
    
    url = f"{API_BASE}/agent/endpoints/{endpoint_slug}/topup"
    headers = {"x-wallet-address": wallet}
    data = {"amount": amount_usd, "chain": "base"}
    
    print(f"[SELLER] Topping up endpoint: {endpoint_slug}")
    print(f"Amount: ${amount_usd} USD")
    
    # Step 1: Get 402 challenge
    response = requests.post(url, json=data, headers=headers)
    
    if response.status_code != 402:
        if response.status_code == 403:
            return {"error": "You don't own this endpoint. Use recharge_credits.py for consumer credit purchases."}
        return {"error": f"Unexpected status: {response.status_code}", "response": response.text}
    
    challenge = response.json()
    
    # Find Base payment option
    base_option = None
    for opt in challenge.get("accepts", []):
        if opt.get("network") == "base":
            base_option = opt
            break
    
    if not base_option:
        return {"error": "No Base payment option available"}
    
    # Step 2: Sign EIP-712 payment
    pay_to = base_option["payTo"]
    amount = int(base_option["maxAmountRequired"])
    
    # Nonce must be bytes32 (0x + 64 hex chars = 32 bytes)
    nonce = "0x" + secrets.token_hex(32)
    valid_after = 0
    valid_before = int(time.time()) + 3600
    
    typed_data = {
        "types": {
            "EIP712Domain": [
                {"name": "name", "type": "string"},
                {"name": "version", "type": "string"},
                {"name": "chainId", "type": "uint256"},
                {"name": "verifyingContract", "type": "address"}
            ],
            "TransferWithAuthorization": [
                {"name": "from", "type": "address"},
                {"name": "to", "type": "address"},
                {"name": "value", "type": "uint256"},
                {"name": "validAfter", "type": "uint256"},
                {"name": "validBefore", "type": "uint256"},
                {"name": "nonce", "type": "bytes32"}
            ]
        },
        "primaryType": "TransferWithAuthorization",
        "domain": {
            "name": USDC_NAME,
            "version": USDC_VERSION,
            "chainId": 8453,
            "verifyingContract": USDC_ADDRESS
        },
        "message": {
            "from": wallet,
            "to": pay_to,
            "value": amount,
            "validAfter": valid_after,
            "validBefore": valid_before,
            "nonce": nonce
        }
    }
    
    account = Account.from_key(private_key)
    signed = account.sign_typed_data(
        typed_data["domain"],
        {"TransferWithAuthorization": typed_data["types"]["TransferWithAuthorization"]},
        typed_data["message"]
    )
    
    payload = {
        "x402Version": 1,
        "scheme": "exact",
        "network": "base",
        "payload": {
            "signature": signed.signature.hex(),
            "authorization": {
                "from": wallet,
                "to": pay_to,
                "value": str(amount),
                "validAfter": str(valid_after),
                "validBefore": str(valid_before),
                "nonce": nonce
            }
        }
    }
    
    x_payment = base64.b64encode(json.dumps(payload).encode()).decode()
    
    # Step 3: Complete topup
    response = requests.post(
        url,
        json=data,
        headers={
            "X-Payment": x_payment,
            "x-wallet-address": wallet
        }
    )
    
    print(f"Response: {response.status_code}")
    
    if response.status_code == 200:
        print(f"\n✅ Credits added to your endpoint!")
        return response.json()
    else:
        return {"error": response.text}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("=" * 60)
        print("SELLER/PROVIDER: Top up YOUR OWN endpoint with credits")
        print("=" * 60)
        print("\nUsage: python topup_endpoint.py <your_endpoint_slug> <amount_usd>")
        print("Example: python topup_endpoint.py my-weather-api 10")
        print("\nNote: You must OWN the endpoint to use this script.")
        print("For CONSUMER credit purchases, use recharge_credits.py instead.")
        sys.exit(1)
    
    result = topup_endpoint(sys.argv[1], float(sys.argv[2]))
    print(json.dumps(result, indent=2))
