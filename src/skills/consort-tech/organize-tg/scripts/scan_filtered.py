#!/usr/bin/env python3
"""
Filtered scan: only non-archived chats, skip personal contacts
"""

import json
import asyncio
from datetime import datetime
from pathlib import Path
from telethon import TelegramClient

SCRIPT_DIR = Path(__file__).parent
CONFIG_FILE = SCRIPT_DIR.parent / ".config.json"
SESSION_FILE = SCRIPT_DIR / "session"
OUTPUT_FILE = SCRIPT_DIR / "filtered_contacts.jsonl"

# Load config
config = json.loads(CONFIG_FILE.read_text())
API_ID = config["api_id"]
API_HASH = config["api_hash"]

async def main():
    print("🔍 Scanning Telegram (filtered - non-archived only)...")
    
    client = TelegramClient(str(SESSION_FILE), API_ID, API_HASH)
    await client.start()
    
    me = await client.get_me()
    print(f"✅ Logged in as: {me.first_name} (@{me.username})")
    
    # Get archived chat IDs to exclude
    print("📦 Getting archived chats...")
    archived_ids = set()
    async for dialog in client.iter_dialogs(archived=True):
        archived_ids.add(dialog.id)
    print(f"   Found {len(archived_ids)} archived chats to exclude")
    
    # Clear output file
    if OUTPUT_FILE.exists():
        OUTPUT_FILE.unlink()
    
    count = 0
    skipped_bot = 0
    
    # Get non-archived dialogs only
    print("📥 Fetching primary inbox contacts...")
    async for dialog in client.iter_dialogs(archived=False):
        # Only private chats (DMs)
        if not dialog.is_user:
            continue
            
        entity = dialog.entity
        
        # Skip bots
        if entity.bot:
            skipped_bot += 1
            continue
        
        # Skip if somehow in archived
        if dialog.id in archived_ids:
            continue
        
        # Get first message for context
        first_msg = None
        async for msg in client.iter_messages(dialog, limit=1, reverse=True):
            first_msg = msg.text[:500] if msg.text else "[media]"
        
        # Get recent message
        recent_msg = None
        if dialog.message and dialog.message.text:
            recent_msg = dialog.message.text[:500]
        
        contact_info = {
            "timestamp": datetime.now().isoformat(),
            "chat_id": dialog.id,
            "name": f"{entity.first_name or ''} {entity.last_name or ''}".strip(),
            "username": entity.username,
            "phone": entity.phone,
            "first_message": first_msg,
            "recent_message": recent_msg,
            "last_active": dialog.date.isoformat() if dialog.date else None,
            "is_contact": entity.contact,
            "status": "pending"
        }
        
        with open(OUTPUT_FILE, "a") as f:
            f.write(json.dumps(contact_info) + "\n")
        
        count += 1
        if count % 50 == 0:
            print(f"   Processed {count} contacts...")
    
    print(f"\n✅ Done!")
    print(f"   Primary inbox contacts: {count}")
    print(f"   Skipped (bots): {skipped_bot}")
    print(f"   Archived chats excluded: {len(archived_ids)}")
    print(f"\n📄 Saved to: {OUTPUT_FILE}")
    
    await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
