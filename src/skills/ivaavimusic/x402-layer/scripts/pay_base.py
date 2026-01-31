#!/usr/bin/env python3
"""
x402 Payment - Base (EVM) Network

Pay for API access using USDC on Base network via EIP-712 permit signatures.

Usage:
    python pay_base.py <endpoint_url>
    
Example:
    python pay_base.py https://api.x402layer.cc/e/weather-data
    
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

# USDC Constants for Base
USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
USDC_NAME = "USD Coin"
USDC_VERSION = "2"

def load_credentials():
    """Load wallet credentials from environment."""
    private_key = os.getenv("PRIVATE_KEY")
    wallet = os.getenv("WALLET_ADDRESS")
    if not private_key or not wallet:
        # Try loading from .env file
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

def create_eip712_signature(challenge, wallet, private_key):
    """Create EIP-712 TransferWithAuthorization signature."""
    
    # Find Base payment option
    base_option = None
    for opt in challenge.get("accepts", []):
        if opt.get("network") == "base":
            base_option = opt
            break
    
    if not base_option:
        raise ValueError("No Base payment option in challenge")
    
    pay_to = base_option["payTo"]
    amount = int(base_option["maxAmountRequired"])
    
    # Nonce must be bytes32 (0x + 64 hex chars = 32 bytes)
    import secrets
    nonce = "0x" + secrets.token_hex(32)  # 32 bytes = 64 hex chars
    
    valid_after = 0
    valid_before = int(time.time()) + 3600  # 1 hour
    
    # EIP-712 typed data for TransferWithAuthorization
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
            "chainId": 8453,  # Base mainnet
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
    
    # Sign the typed data
    account = Account.from_key(private_key)
    signed = account.sign_typed_data(
        typed_data["domain"],
        {"TransferWithAuthorization": typed_data["types"]["TransferWithAuthorization"]},
        typed_data["message"]
    )
    
    # Build x402 payload
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
    
    return base64.b64encode(json.dumps(payload).encode()).decode()

def pay_for_access(endpoint_url: str) -> dict:
    """Execute paid request to an x402 endpoint."""
    private_key, wallet = load_credentials()
    
    print(f"Requesting: {endpoint_url}")
    
    # Step 1: Get 402 challenge
    response = requests.get(endpoint_url, headers={"Accept": "application/json"})
    
    if response.status_code == 200:
        print("Access granted (free endpoint)")
        return response.json() if response.headers.get("content-type", "").startswith("application/json") else {"data": response.text}
    
    if response.status_code != 402:
        print(f"Unexpected status: {response.status_code}")
        return {"error": response.text}
    
    challenge = response.json()
    print(f"Payment required: {challenge.get('accepts', [{}])[0].get('maxAmountRequired')} units")
    
    # Step 2: Sign payment
    x_payment = create_eip712_signature(challenge, wallet, private_key)
    
    # Step 3: Send with payment header
    response = requests.get(
        endpoint_url,
        headers={
            "X-Payment": x_payment,
            "Accept": "application/json"
        }
    )
    
    print(f"Response: {response.status_code}")
    
    if response.status_code == 200:
        return response.json() if response.headers.get("content-type", "").startswith("application/json") else {"data": response.text[:500]}
    else:
        return {"error": response.text}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python pay_base.py <endpoint_url>")
        sys.exit(1)
    
    result = pay_for_access(sys.argv[1])
    print(json.dumps(result, indent=2)[:500])
