#!/usr/bin/env python3
"""
x402 Endpoint Management

View, update, and manage your agentic endpoints.

Usage:
    python manage_endpoint.py list                    # List all endpoints
    python manage_endpoint.py info <slug>             # Get endpoint info
    python manage_endpoint.py update <slug> --price 0.02  # Update price
    python manage_endpoint.py stats <slug>            # View usage stats
    
Environment Variables:
    WALLET_ADDRESS - Your wallet address (0x...)
    API_KEY - Your endpoint API key (optional, for owner actions)
"""

import os
import sys
import json
import argparse
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
    return wallet

def list_endpoints() -> dict:
    """List all endpoints owned by the wallet."""
    wallet = load_wallet()
    if not wallet:
        return {"error": "Set WALLET_ADDRESS environment variable"}
    
    url = f"{API_BASE}/api/endpoints"
    headers = {"x-wallet-address": wallet}
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        return response.json()
    else:
        return {"error": response.text}

def get_endpoint_info(slug: str) -> dict:
    """Get details about an endpoint."""
    url = f"{API_BASE}/api/endpoints/{slug}"
    
    response = requests.get(url)
    
    if response.status_code == 200:
        return response.json()
    else:
        return {"error": response.text}

def get_endpoint_stats(slug: str) -> dict:
    """Get usage statistics for an endpoint."""
    wallet = load_wallet()
    api_key = os.getenv("API_KEY")
    
    url = f"{API_BASE}/api/endpoints/{slug}/stats"
    headers = {}
    
    if wallet:
        headers["x-wallet-address"] = wallet
    if api_key:
        headers["x-api-key"] = api_key
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        return response.json()
    else:
        return {"error": response.text}

def update_endpoint(slug: str, price: float = None, name: str = None, origin_url: str = None) -> dict:
    """Update endpoint configuration."""
    wallet = load_wallet()
    if not wallet:
        return {"error": "Set WALLET_ADDRESS environment variable"}
    
    url = f"{API_BASE}/api/endpoints/{slug}"
    headers = {"x-wallet-address": wallet}
    
    data = {}
    if price is not None:
        data["price"] = price
    if name is not None:
        data["name"] = name
    if origin_url is not None:
        data["origin_url"] = origin_url
    
    if not data:
        return {"error": "No updates specified"}
    
    response = requests.patch(url, json=data, headers=headers)
    
    if response.status_code == 200:
        return response.json()
    else:
        return {"error": response.text}

def main():
    parser = argparse.ArgumentParser(description="Manage x402 endpoints")
    subparsers = parser.add_subparsers(dest="command", help="Command")
    
    # List command
    subparsers.add_parser("list", help="List all your endpoints")
    
    # Info command
    info_parser = subparsers.add_parser("info", help="Get endpoint info")
    info_parser.add_argument("slug", help="Endpoint slug")
    
    # Stats command
    stats_parser = subparsers.add_parser("stats", help="Get endpoint statistics")
    stats_parser.add_argument("slug", help="Endpoint slug")
    
    # Update command
    update_parser = subparsers.add_parser("update", help="Update endpoint")
    update_parser.add_argument("slug", help="Endpoint slug")
    update_parser.add_argument("--price", type=float, help="New price in USD")
    update_parser.add_argument("--name", help="New name")
    update_parser.add_argument("--origin-url", help="New origin URL")
    
    args = parser.parse_args()
    
    if args.command == "list":
        result = list_endpoints()
    elif args.command == "info":
        result = get_endpoint_info(args.slug)
    elif args.command == "stats":
        result = get_endpoint_stats(args.slug)
    elif args.command == "update":
        result = update_endpoint(args.slug, args.price, args.name, getattr(args, 'origin_url', None))
    else:
        parser.print_help()
        return
    
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
