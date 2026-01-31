#!/usr/bin/env python3
"""
x402 Marketplace Listing

List your endpoint on the x402 marketplace for discovery.

Usage:
    python list_on_marketplace.py <slug> --category <category> --description "Description"
    
Example:
    python list_on_marketplace.py my-api --category ai --description "AI-powered analysis API"
    
Categories: ai, data, finance, utility, social, gaming
    
Environment Variables:
    WALLET_ADDRESS - Your wallet address (endpoint owner)
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
    
    if not wallet:
        print("Error: Set WALLET_ADDRESS environment variable")
        sys.exit(1)
    return wallet

def list_endpoint(slug: str, category: str, description: str, tags: list = None) -> dict:
    """
    List an endpoint on the marketplace.
    
    Args:
        slug: Endpoint slug
        category: Category (ai, data, finance, utility, social, gaming)
        description: Public description
        tags: Optional list of tags
    """
    wallet = load_wallet()
    
    url = f"{API_BASE}/api/marketplace/list"
    headers = {"x-wallet-address": wallet}
    
    data = {
        "slug": slug,
        "category": category,
        "description": description
    }
    
    if tags:
        data["tags"] = tags
    
    print(f"Listing endpoint: {slug}")
    print(f"Category: {category}")
    print(f"Description: {description[:50]}...")
    
    response = requests.post(url, json=data, headers=headers)
    
    if response.status_code in [200, 201]:
        print("\\n✅ Endpoint listed on marketplace!")
        return response.json()
    else:
        return {"error": response.text}

def unlist_endpoint(slug: str) -> dict:
    """Remove an endpoint from the marketplace."""
    wallet = load_wallet()
    
    url = f"{API_BASE}/api/marketplace/unlist"
    headers = {"x-wallet-address": wallet}
    data = {"slug": slug}
    
    response = requests.post(url, json=data, headers=headers)
    
    if response.status_code == 200:
        print(f"\\n✅ Endpoint {slug} removed from marketplace")
        return response.json()
    else:
        return {"error": response.text}

def main():
    parser = argparse.ArgumentParser(description="List endpoint on marketplace")
    parser.add_argument("slug", help="Endpoint slug")
    parser.add_argument("--category", choices=["ai", "data", "finance", "utility", "social", "gaming"],
                        required=True, help="Marketplace category")
    parser.add_argument("--description", required=True, help="Public description")
    parser.add_argument("--tags", nargs="+", help="Optional tags")
    parser.add_argument("--unlist", action="store_true", help="Remove from marketplace")
    
    args = parser.parse_args()
    
    if args.unlist:
        result = unlist_endpoint(args.slug)
    else:
        result = list_endpoint(args.slug, args.category, args.description, args.tags)
    
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
