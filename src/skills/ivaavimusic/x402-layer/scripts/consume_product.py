#!/usr/bin/env python3
"""
consume_product.py - Purchase and download digital products from x402 Singularity Layer

This script enables agents to buy digital goods (files, assets, etc.) from the x402 marketplace.
After payment verification, a temporary signed download URL is returned.

Usage:
    python consume_product.py <product-slug-or-url>
    
Examples:
    python consume_product.py pussio
    python consume_product.py https://studio.x402layer.cc/pay/pussio
    python consume_product.py https://api.x402layer.cc/storage/product/abc123-uuid
    
Environment Variables:
    PRIVATE_KEY - Your EVM wallet private key (Base network)
    WALLET_ADDRESS - Your EVM wallet address
    
Returns:
    JSON with downloadUrl and fileName on success
"""

import os
import sys
import json
import time
import secrets
import requests
from typing import Optional, Tuple

# Constants
API_BASE = "https://api.x402layer.cc"
STUDIO_BASE = "https://studio.x402layer.cc"

# USDC on Base
USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
USDC_NAME = "USD Coin"
USDC_VERSION = "2"


def load_credentials() -> Tuple[str, str]:
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


def resolve_product_url(product_input: str) -> str:
    """
    Resolve various product input formats to the API URL.
    
    Accepts:
        - Product slug: "pussio"
        - Studio URL: "https://studio.x402layer.cc/pay/pussio"
        - API URL: "https://api.x402layer.cc/storage/product/{uuid}"
    """
    # Already an API URL
    if product_input.startswith(f"{API_BASE}/storage/product/"):
        return product_input
    
    # Studio URL - extract slug
    if product_input.startswith(f"{STUDIO_BASE}/pay/"):
        slug = product_input.replace(f"{STUDIO_BASE}/pay/", "").strip("/")
        # Need to resolve slug to product ID
        return resolve_slug_to_api_url(slug)
    
    # Just a slug
    if not product_input.startswith("http"):
        return resolve_slug_to_api_url(product_input)
    
    raise ValueError(f"Unknown product URL format: {product_input}")


def resolve_slug_to_api_url(slug: str) -> str:
    """Resolve a product slug to the API download URL by looking up the product ID."""
    # Query marketplace for the product
    response = requests.get(
        f"{API_BASE}/marketplace",
        params={"type": "product", "search": slug}
    )
    
    if response.status_code != 200:
        raise ValueError(f"Failed to query marketplace: {response.status_code}")
    
    data = response.json()
    items = data.get("items", [])
    
    # Find exact slug match
    product = next((item for item in items if item.get("slug") == slug), None)
    
    if not product:
        # Try to find by partial match
        product = next((item for item in items if slug.lower() in item.get("slug", "").lower()), None)
    
    if not product:
        raise ValueError(f"Product not found: {slug}")
    
    product_id = product.get("id")
    if not product_id:
        raise ValueError(f"Product ID not found for slug: {slug}")
    
    return f"{API_BASE}/storage/product/{product_id}"


def create_eip712_signature(
    private_key: str,
    wallet: str,
    pay_to: str,
    amount: int,
    nonce: str,
    valid_after: int,
    valid_before: int
) -> dict:
    """Create EIP-712 TransferWithAuthorization signature."""
    from eth_account import Account
    from eth_account.messages import encode_typed_data
    
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
    
    encoded = encode_typed_data(full_message=typed_data)
    signed = Account.sign_message(encoded, private_key=private_key)
    
    return {
        "signature": signed.signature.hex(),
        "nonce": nonce,
        "validAfter": valid_after,
        "validBefore": valid_before
    }


def consume_product(product_input: str, download_file: bool = False) -> dict:
    """
    Purchase and retrieve a digital product.
    
    Args:
        product_input: Product slug, studio URL, or API URL
        download_file: If True, also download the file to current directory
        
    Returns:
        dict with downloadUrl and fileName
    """
    private_key, wallet = load_credentials()
    
    # Resolve to API URL
    print(f"Resolving product: {product_input}")
    api_url = resolve_product_url(product_input)
    print(f"API URL: {api_url}")
    
    # Step 1: Request without payment to get 402 response
    print("\nStep 1: Fetching product payment requirements...")
    response = requests.get(api_url, headers={"Accept": "application/json"})
    
    if response.status_code == 200:
        # Product is free or already paid
        print("Product is free or already authorized!")
        return response.json()
    
    if response.status_code != 402:
        raise ValueError(f"Unexpected response: {response.status_code} - {response.text}")
    
    # Parse 402 payment requirements
    payment_info = response.json().get("payment", {})
    
    recipient = payment_info.get("recipient")
    price = payment_info.get("amount")
    currency = payment_info.get("currency", "USDC")
    network = payment_info.get("network", "base")
    
    print(f"Payment required:")
    print(f"  Recipient: {recipient}")
    print(f"  Amount: {price} {currency}")
    print(f"  Network: {network}")
    
    if network != "base":
        raise ValueError(f"This script only supports Base network. Product requires: {network}")
    
    if currency not in ["USDC", "USD"]:
        raise ValueError(f"This script only supports USDC. Product requires: {currency}")
    
    # Step 2: Create EIP-712 signature
    print("\nStep 2: Signing payment with EIP-712...")
    
    # Convert price to atomic units (6 decimals for USDC)
    amount = int(float(price) * 1e6)
    
    # Nonce must be bytes32 (0x + 64 hex chars = 32 bytes)
    nonce = "0x" + secrets.token_hex(32)
    valid_after = 0
    valid_before = int(time.time()) + 3600  # 1 hour validity
    
    sig_data = create_eip712_signature(
        private_key=private_key,
        wallet=wallet,
        pay_to=recipient,
        amount=amount,
        nonce=nonce,
        valid_after=valid_after,
        valid_before=valid_before
    )
    
    # Step 3: Build X-Payment payload
    payment_payload = {
        "x402Version": 1,
        "scheme": "exact",
        "network": "base",
        "payload": {
            "signature": sig_data["signature"],
            "authorization": {
                "from": wallet,
                "to": recipient,
                "value": str(amount),
                "validAfter": str(valid_after),
                "validBefore": str(valid_before),
                "nonce": nonce
            }
        }
    }
    
    # Step 4: Make request with payment
    print("\nStep 3: Submitting payment and requesting download...")
    
    response = requests.get(
        api_url,
        headers={
            "X-Payment": json.dumps(payment_payload),
            "Accept": "application/json"
        }
    )
    
    if response.status_code != 200:
        raise ValueError(f"Payment failed: {response.status_code} - {response.text}")
    
    result = response.json()
    
    print(f"\n✅ Product purchased successfully!")
    print(f"Download URL: {result.get('downloadUrl', 'N/A')}")
    print(f"File Name: {result.get('fileName', 'N/A')}")
    
    # Optional: Download the file
    if download_file and result.get("downloadUrl"):
        filename = result.get("fileName", "downloaded_product")
        print(f"\nDownloading file to: {filename}")
        
        file_response = requests.get(result["downloadUrl"])
        if file_response.status_code == 200:
            with open(filename, "wb") as f:
                f.write(file_response.content)
            print(f"✅ Downloaded: {filename} ({len(file_response.content)} bytes)")
        else:
            print(f"❌ Download failed: {file_response.status_code}")
    
    return result


def main():
    if len(sys.argv) < 2:
        print("Usage: python consume_product.py <product-slug-or-url> [--download]")
        print("\nExamples:")
        print("  python consume_product.py pussio")
        print("  python consume_product.py https://studio.x402layer.cc/pay/pussio")
        print("  python consume_product.py pussio --download")
        sys.exit(1)
    
    product_input = sys.argv[1]
    download_file = "--download" in sys.argv
    
    try:
        result = consume_product(product_input, download_file=download_file)
        print("\nResult:")
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
