#!/usr/bin/env python3
"""
TG Contact Sync - Setup Wizard
Guides user through Telegram API and Google Sheets setup
"""

import os
import sys
import json
import subprocess
import asyncio
from pathlib import Path

SKILL_DIR = Path(__file__).parent.parent
SCRIPTS_DIR = SKILL_DIR / "scripts"
CONFIG_FILE = SKILL_DIR / ".config.json"

# Template sheet (public, view-only, owned by consorttechnologies@gmail.com)
TEMPLATE_COPY_URL = "https://docs.google.com/spreadsheets/d/1myBWVBnylkdOIvhZaCy3qJHIe-Oqeltcy41xYh5EjwE/copy"

def print_step(num, title):
    print(f"\n{'='*50}")
    print(f"Step {num}: {title}")
    print('='*50 + "\n")

def check_gog():
    """Check if gog CLI is available"""
    result = subprocess.run(["which", "gog"], capture_output=True)
    return result.returncode == 0

async def test_telegram(api_id, api_hash):
    """Test Telegram connection - handles phone auth interactively"""
    try:
        from telethon import TelegramClient
    except ImportError:
        print("Installing telethon...")
        subprocess.run([sys.executable, "-m", "pip", "install", "telethon", "-q"])
        from telethon import TelegramClient
    
    session_path = SCRIPTS_DIR / "session"
    client = TelegramClient(str(session_path), api_id, api_hash)
    
    print("\nConnecting to Telegram...")
    print("(You may be asked for your phone number and verification code)")
    print("")
    print("="*60)
    print("⚠️  CRITICAL: ENTER THE CODE IN THIS TERMINAL WINDOW")
    print("="*60)
    print("")
    print("   ❌ DO NOT send the code in ANY Telegram message")
    print("   ❌ DO NOT share it in chat with anyone (including AI)")
    print("   ❌ DO NOT copy/paste it anywhere except HERE")
    print("")
    print("   Telegram REJECTS codes that appear in messages.")
    print("   If you send it in chat, it becomes INVALID immediately.")
    print("")
    print("="*60)
    print("")
    
    await client.start()
    me = await client.get_me()
    await client.disconnect()
    
    return me.first_name, me.username

def setup_telegram():
    """Guide user through Telegram API setup"""
    print_step(1, "Telegram API Setup")
    
    print("To connect to Telegram, you need API credentials.")
    print("\n1. Go to: https://my.telegram.org")
    print("2. Log in with your phone number")
    print("3. Click 'API development tools'")
    print("4. Create a new application (any name/platform)")
    print("5. Copy the api_id and api_hash\n")
    
    api_id = input("Enter your api_id: ").strip()
    api_hash = input("Enter your api_hash: ").strip()
    
    if not api_id or not api_hash:
        print("❌ API credentials required")
        return None, None
    
    try:
        api_id = int(api_id)
    except:
        print("❌ api_id must be a number")
        return None, None
    
    # Test connection (interactive - will prompt for phone if needed)
    try:
        first_name, username = asyncio.run(test_telegram(api_id, api_hash))
        print(f"\n✅ Connected as {first_name} (@{username})")
        return api_id, api_hash
    except Exception as e:
        print(f"\n❌ Connection failed: {e}")
        return None, None

def setup_google():
    """Guide user through Google Sheets setup"""
    print_step(2, "Google Sheets Setup")
    
    if not check_gog():
        print("❌ 'gog' CLI not found.")
        print("   Install with: brew install steipete/tap/gogcli")
        print("")
        print("   Then set up your Google OAuth credentials:")
        print("   1. Create OAuth app in Google Cloud Console")
        print("   2. Download client_secret.json")
        print("   3. Run: gog auth credentials set ~/Downloads/client_secret_XXXX.json")
        print("   4. Run: gog auth add youremail@gmail.com --services sheets")
        return None, None
    
    # Check existing gog accounts
    result = subprocess.run(["gog", "auth", "list"], capture_output=True, text=True)
    
    if result.returncode == 0 and result.stdout.strip():
        print("Found existing gog accounts:")
        print(result.stdout)
        print("")
    
    print("Enter your Google account email (must be set up in gog):")
    account = input("Email: ").strip()
    
    if not account or "@" not in account:
        print("❌ Valid email required")
        return None, None
    
    # Check if Google auth is set up
    print(f"\nChecking Google auth for {account}...")
    auth_check = subprocess.run(
        f"gog sheets get 1myBWVBnylkdOIvhZaCy3qJHIe-Oqeltcy41xYh5EjwE 'Tech/Fintech!A1' --account {account} 2>&1",
        shell=True, capture_output=True, text=True
    )
    
    if "No auth for" in auth_check.stdout or "No auth for" in auth_check.stderr or "no refresh token" in auth_check.stderr.lower():
        print("")
        print("=" * 50)
        print("GOOGLE AUTH REQUIRED")
        print("=" * 50)
        print(f"\nYou need to add your Google account to gog first.")
        print(f"\nRun this command in a NEW terminal window:")
        print(f"")
        print(f"   gog auth add {account} --services sheets")
        print(f"")
        print("This will open a browser to log in to Google.")
        print("After you complete the login, come back here.")
        print("")
        input("Press ENTER when you've completed Google auth...")
        
        # Re-check
        auth_check2 = subprocess.run(
            f"gog sheets get 1myBWVBnylkdOIvhZaCy3qJHIe-Oqeltcy41xYh5EjwE 'Tech/Fintech!A1' --account {account} 2>&1",
            shell=True, capture_output=True, text=True
        )
        
        if "No auth for" in auth_check2.stdout or "No auth for" in auth_check2.stderr:
            print("❌ Google auth still not set up. Please try again.")
            return None, None
        
        print("✅ Google auth verified!")
    else:
        print("✅ Google auth already set up!")
    
    print(f"\n📋 Now let's set up your contact sheet.\n")
    print("=" * 60)
    print("⚠️  IMPORTANT: BROWSER ACCOUNT MISMATCH WARNING")
    print("=" * 60)
    print(f"\nYour gog CLI is authenticated as: {account}")
    print("")
    print("When the browser opens to copy the template:")
    print("  1. CHECK which Google account is active (top-right corner)")
    print(f"  2. If it's NOT {account}, click your avatar and SWITCH accounts")
    print("  3. THEN click 'Make a copy'")
    print("")
    print("⚠️  The sheet MUST be copied to the same account as gog!")
    print("   Otherwise you'll get a 403 permission error.")
    print("")
    print("=" * 60)
    print("")
    input("Press ENTER when you're ready to open the template link...")
    print("")
    print("=" * 50)
    print("COPY THE TEMPLATE TO YOUR DRIVE:")
    print("=" * 50)
    print(f"\n1. Open this link:\n   {TEMPLATE_COPY_URL}")
    print("\n2. Click 'Make a copy' (it will save to YOUR Drive)")
    print("\n3. Your new sheet will open. Look at the URL in your browser:")
    print("")
    print("   https://docs.google.com/spreadsheets/d/1ABC123xyz.../edit")
    print("                                          ^^^^^^^^^^^^")
    print("                                          THIS IS YOUR SHEET ID")
    print("")
    print("   The Sheet ID is the long string between /d/ and /edit")
    print("")
    
    sheet_id = input("Paste your new Sheet ID here: ").strip()
    
    # Clean up if they pasted a full URL
    if "spreadsheets/d/" in sheet_id:
        sheet_id = sheet_id.split("spreadsheets/d/")[1].split("/")[0]
    
    if not sheet_id or len(sheet_id) < 20:
        print("❌ Invalid sheet ID")
        return None, None
    
    # Verify access
    print("\nVerifying sheet access...")
    result = subprocess.run(
        f"gog sheets get {sheet_id} 'Tech/Fintech!A1:E1' --json --account {account} 2>&1",
        shell=True, capture_output=True, text=True
    )
    
    if "COMPANY" in result.stdout:
        print(f"✅ Sheet verified!")
    else:
        print(f"⚠️  Couldn't verify sheet. Make sure you have edit access.")
        print(f"   Error: {result.stderr or result.stdout}")
        confirm = input("Continue anyway? [y/N]: ").strip().lower()
        if confirm != 'y':
            return None, None
    
    return account, sheet_id

def save_config(config):
    """Save configuration"""
    CONFIG_FILE.write_text(json.dumps(config, indent=2))
    print(f"\n✅ Configuration saved!")

def main():
    print("\n" + "="*55)
    print("   Organize TG by Consort Technologies - Setup")
    print("="*55)
    
    # Step 1: Telegram
    api_id, api_hash = setup_telegram()
    if not api_id:
        print("\n❌ Setup failed at Telegram step")
        sys.exit(1)
    
    # Step 2: Google
    google_account, sheet_id = setup_google()
    if not sheet_id:
        print("\n❌ Setup failed at Google step")
        sys.exit(1)
    
    # Save config
    config = {
        "api_id": api_id,
        "api_hash": api_hash,
        "google_account": google_account,
        "sheet_id": sheet_id
    }
    save_config(config)
    
    # Done
    print("\n" + "="*50)
    print("   ✅ Setup Complete!")
    print("="*50)
    print(f"\nYour contact sheet:")
    print(f"https://docs.google.com/spreadsheets/d/{sheet_id}")
    print("\nRun './tg-sync test' to verify with 20 contacts!")
    print("Then './tg-sync run' to sync everything.")
    print("\n" + "="*50)
    print("   💜 This skill is free. Tips appreciated!")
    print("="*50)
    print("EVM:    0x5aA2C5002e1EcF4b5CcCf5DF0e990e76181B171f")
    print("Solana: AZHUw8Fdvehj22Ne3Z76iVSQtme3Xhn4BXFEagJvh3SH")
    print("="*50)

if __name__ == "__main__":
    main()
