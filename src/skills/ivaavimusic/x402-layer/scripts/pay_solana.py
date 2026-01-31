#!/usr/bin/env python3
"""
x402 Payment - Solana Network

Pay for API access using USDC on Solana via SPL Token transfers.

Note: Solana payments have ~75% success rate due to facilitator infrastructure.
Retry logic is recommended. For maximum reliability, use Base (EVM) payments.

Usage:
    python pay_solana.py <endpoint_url>
    
Environment Variables:
    SOLANA_SECRET_KEY - Your Solana secret key as JSON array [1,2,3,...]
    
Dependencies:
    pip install solders solana requests
"""

import os
import sys
import json
import base64
import struct
import requests
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import VersionedTransaction
from solders.message import MessageV0
from solders.instruction import Instruction, AccountMeta
from solders.hash import Hash
from solders.compute_budget import set_compute_unit_limit, set_compute_unit_price

# Constants
TOKEN_PROGRAM_ID = Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
ATA_PROGRAM_ID = Pubkey.from_string("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
USDC_MINT = Pubkey.from_string("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
RPC_URL = "https://api.mainnet-beta.solana.com"

def load_keypair():
    """Load Solana keypair from environment."""
    secret_key_json = os.getenv("SOLANA_SECRET_KEY")
    if not secret_key_json:
        print("Error: Set SOLANA_SECRET_KEY environment variable")
        sys.exit(1)
    secret_bytes = bytes(json.loads(secret_key_json))
    return Keypair.from_bytes(secret_bytes)

def get_ata(owner: Pubkey, mint: Pubkey) -> Pubkey:
    """Derive Associated Token Account address."""
    seeds = [bytes(owner), bytes(TOKEN_PROGRAM_ID), bytes(mint)]
    ata, _ = Pubkey.find_program_address(seeds, ATA_PROGRAM_ID)
    return ata

def create_transfer_checked_ix(source: Pubkey, mint: Pubkey, dest: Pubkey, owner: Pubkey, amount: int, decimals: int) -> Instruction:
    """Create SPL Token TransferChecked instruction."""
    # Instruction data: [12, amount (u64), decimals (u8)]
    data = bytes([12]) + struct.pack("<Q", amount) + bytes([decimals])
    
    keys = [
        AccountMeta(source, False, True),
        AccountMeta(mint, False, False),
        AccountMeta(dest, False, True),
        AccountMeta(owner, True, False),
    ]
    return Instruction(TOKEN_PROGRAM_ID, data, keys)

def get_recent_blockhash() -> Hash:
    """Fetch recent blockhash from Solana RPC."""
    response = requests.post(RPC_URL, json={
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getLatestBlockhash",
        "params": [{"commitment": "finalized"}]
    })
    result = response.json()
    return Hash.from_string(result["result"]["value"]["blockhash"])

def pay_for_access(endpoint_url: str, max_retries: int = 3) -> dict:
    """Execute paid request to an x402 endpoint with retry logic."""
    keypair = load_keypair()
    print(f"Wallet: {keypair.pubkey()}")
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
    
    # Find Solana option
    solana_opt = None
    for opt in challenge.get("accepts", []):
        if opt.get("network") == "solana":
            solana_opt = opt
            break
    
    if not solana_opt:
        return {"error": "No Solana payment option available"}
    
    print(f"Payment required: {solana_opt['maxAmountRequired']} atomic units")
    
    # Retry loop for Solana (due to infrastructure issues)
    for attempt in range(max_retries):
        try:
            # Step 2: Build transaction
            fee_payer = Pubkey.from_string(solana_opt["extra"]["feePayer"])
            pay_to = Pubkey.from_string(solana_opt["payTo"])
            mint = Pubkey.from_string(solana_opt["asset"])
            amount = int(solana_opt["maxAmountRequired"])
            
            source_ata = get_ata(keypair.pubkey(), mint)
            dest_ata = get_ata(pay_to, mint)
            
            blockhash = get_recent_blockhash()
            
            # Build instructions
            instructions = [
                set_compute_unit_limit(200000),
                set_compute_unit_price(1000),
                create_transfer_checked_ix(source_ata, mint, dest_ata, keypair.pubkey(), amount, 6)
            ]
            
            # Build MessageV0 with facilitator as fee payer
            message = MessageV0.try_compile(
                fee_payer,
                instructions,
                [],  # Address lookup tables
                blockhash
            )
            
            tx = VersionedTransaction(message, [keypair])
            serialized = bytes(tx)
            base64_tx = base64.b64encode(serialized).decode()
            
            # Step 3: Build X-Payment header
            payload = {
                "x402Version": 1,
                "scheme": "exact",
                "network": "solana",
                "payload": {"transaction": base64_tx}
            }
            x_payment = base64.b64encode(json.dumps(payload).encode()).decode()
            
            # Step 4: Send payment
            response = requests.get(
                endpoint_url,
                headers={"X-Payment": x_payment, "Accept": "application/json"}
            )
            
            if response.status_code == 200:
                print(f"Success on attempt {attempt + 1}")
                return response.json() if response.headers.get("content-type", "").startswith("application/json") else {"data": response.text[:500]}
            
            print(f"Attempt {attempt + 1} failed: {response.status_code}")
            
        except Exception as e:
            print(f"Attempt {attempt + 1} error: {e}")
    
    return {"error": "All retry attempts failed"}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python pay_solana.py <endpoint_url>")
        sys.exit(1)
    
    result = pay_for_access(sys.argv[1])
    print(json.dumps(result, indent=2)[:500])
