#!/usr/bin/env python3
"""
x402 Credit Balance Check

Check your credit balance for a specific endpoint.

Usage:
    python check_credits.py <endpoint_slug>
    
Example:
    python check_credits.py weather-data
    
Environment Variables:
    WALLET_ADDRESS - Your wallet address
"""

import os
import sys
import json
import requests

API_BASE = "https://api.x402layer.cc"

def load_wallet():
    """Load wallet address from environment."""
    wallet = os.getenv("WALLET_ADDRESS")
    if not wallet:
        try:
            from dotenv import load_dotenv
            load_dotenv()
            wallet = os.getenv("WALLET_ADDRESS")
        except ImportError:
            pass
    
    if not wallet:
        print("Error: Set WALLET_ADDRESS environment variable")
        sys.exit(1)
    return wallet

def check_credits(endpoint_slug: str) -> dict:
    """Check credit balance for an endpoint."""
    wallet = load_wallet()
    
    url = f"{API_BASE}/api/credits/balance"
    params = {"endpoint": endpoint_slug}
    headers = {"x-wallet-address": wallet}
    
    print(f"Checking credits for: {endpoint_slug}")
    
    response = requests.get(url, params=params, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print(f"Balance: {data.get('balance', 0)} credits")
        return data
    else:
        return {"error": response.text}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python check_credits.py <endpoint_slug>")
        sys.exit(1)
    
    result = check_credits(sys.argv[1])
    print(json.dumps(result, indent=2))
