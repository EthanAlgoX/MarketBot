#!/usr/bin/env python3
"""
x402 Credit Recharge

Purchase credit packs for an endpoint using USDC.

Usage:
    python recharge_credits.py <endpoint_slug> <pack_id>
    
Example:
    python recharge_credits.py weather-data pack_100
    
Environment Variables:
    PRIVATE_KEY - Your EVM private key (0x...)
    WALLET_ADDRESS - Your wallet address (0x...)
"""

import os
import sys
import json
import time
import base64
import requests
from eth_account import Account
from eth_account.messages import encode_typed_data

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

def get_available_packs(endpoint_slug: str) -> list:
    """Get available credit packs for an endpoint."""
    url = f"{API_BASE}/api/credits/packs"
    params = {"endpoint": endpoint_slug}
    
    response = requests.get(url, params=params)
    if response.status_code == 200:
        return response.json().get("packs", [])
    return []

def recharge_credits(endpoint_slug: str, pack_id: str) -> dict:
    """Purchase credits for an endpoint."""
    private_key, wallet = load_credentials()
    
    # Step 1: Initiate purchase to get 402 challenge
    url = f"{API_BASE}/api/credits/purchase"
    data = {
        "endpoint": endpoint_slug,
        "packId": pack_id,
        "chain": "base"
    }
    headers = {"x-wallet-address": wallet}
    
    print(f"Purchasing {pack_id} for {endpoint_slug}")
    
    response = requests.post(url, json=data, headers=headers)
    
    if response.status_code != 402:
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
    import secrets
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
    
    # Step 3: Complete purchase
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
        return response.json()
    else:
        return {"error": response.text}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python recharge_credits.py <endpoint_slug> <pack_id>")
        print("       python recharge_credits.py --list <endpoint_slug>  # List packs")
        sys.exit(1)
    
    if sys.argv[1] == "--list":
        packs = get_available_packs(sys.argv[2])
        print(json.dumps(packs, indent=2))
    else:
        result = recharge_credits(sys.argv[1], sys.argv[2])
        print(json.dumps(result, indent=2))
