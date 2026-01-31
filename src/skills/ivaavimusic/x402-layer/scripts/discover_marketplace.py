#!/usr/bin/env python3
"""
x402 Marketplace Discovery

Browse and search the x402 marketplace for available API endpoints.

Usage:
    python discover_marketplace.py                    # List all endpoints
    python discover_marketplace.py search <query>     # Search endpoints
    python discover_marketplace.py category <type>    # Filter by category
    python discover_marketplace.py featured           # Show featured endpoints
    
Categories: ai, data, finance, utility, social, gaming
"""

import os
import sys
import json
import requests

API_BASE = "https://api.x402layer.cc"

def list_all_endpoints() -> dict:
    """List all marketplace endpoints."""
    url = f"{API_BASE}/api/marketplace"
    
    response = requests.get(url)
    
    if response.status_code == 200:
        return response.json()
    else:
        return {"error": response.text}

def search_endpoints(query: str) -> dict:
    """Search marketplace by keyword."""
    url = f"{API_BASE}/api/marketplace/search"
    params = {"q": query}
    
    response = requests.get(url, params=params)
    
    if response.status_code == 200:
        return response.json()
    else:
        return {"error": response.text}

def get_by_category(category: str) -> dict:
    """Get endpoints by category."""
    url = f"{API_BASE}/api/marketplace"
    params = {"category": category}
    
    response = requests.get(url, params=params)
    
    if response.status_code == 200:
        return response.json()
    else:
        return {"error": response.text}

def get_featured() -> dict:
    """Get featured endpoints."""
    url = f"{API_BASE}/api/marketplace/featured"
    
    response = requests.get(url)
    
    if response.status_code == 200:
        return response.json()
    else:
        return {"error": response.text}

def get_endpoint_details(slug: str) -> dict:
    """Get detailed info about an endpoint."""
    url = f"{API_BASE}/api/marketplace/{slug}"
    
    response = requests.get(url)
    
    if response.status_code == 200:
        return response.json()
    else:
        return {"error": response.text}

def main():
    if len(sys.argv) < 2:
        # Default: list all
        result = list_all_endpoints()
    elif sys.argv[1] == "search" and len(sys.argv) >= 3:
        result = search_endpoints(sys.argv[2])
    elif sys.argv[1] == "category" and len(sys.argv) >= 3:
        result = get_by_category(sys.argv[2])
    elif sys.argv[1] == "featured":
        result = get_featured()
    elif sys.argv[1] == "details" and len(sys.argv) >= 3:
        result = get_endpoint_details(sys.argv[2])
    else:
        print("Usage:")
        print("  python discover_marketplace.py                    # List all")
        print("  python discover_marketplace.py search <query>     # Search")
        print("  python discover_marketplace.py category <type>    # By category")
        print("  python discover_marketplace.py featured           # Featured")
        print("  python discover_marketplace.py details <slug>     # Endpoint info")
        return
    
    # Pretty print results
    if "endpoints" in result:
        endpoints = result["endpoints"]
        print(f"Found {len(endpoints)} endpoints:")
        for ep in endpoints[:10]:  # Show first 10
            print(f"  - {ep.get('slug', '?')} | ${ep.get('price', 0)} | {ep.get('name', 'Unnamed')}")
    else:
        print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
