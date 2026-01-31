#!/usr/bin/env python3
"""
Append new contacts to existing companies
"""

import json
import subprocess
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
CONFIG_FILE = SCRIPT_DIR.parent / ".config.json"
REVIEW_LIST = SCRIPT_DIR / "review_list.json"

config = json.loads(CONFIG_FILE.read_text())
SHEET_ID = config["sheet_id"]
ACCOUNT = config["google_account"]

def get_sheet_data(page):
    cmd = f"gog sheets get {SHEET_ID} '{page}!A:E' --json --account {ACCOUNT} 2>/dev/null"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode == 0:
        return json.loads(result.stdout).get("values", [])
    return []

def update_comms_channel(page, row_num, new_comms):
    cell = f"'{page}'!D{row_num}"
    cmd = f"gog sheets update {SHEET_ID} '{cell}' --values-json '[[{json.dumps(new_comms)}]]' --input USER_ENTERED --account {ACCOUNT}"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.returncode == 0

if not REVIEW_LIST.exists():
    print("❌ No review list. Run: tg-sync scan")
    exit(1)

contacts = json.load(open(REVIEW_LIST))
to_append = [c for c in contacts if c["exists"]]

print(f"Appending {len(to_append)} contacts to existing companies...\n")

added = 0
skipped = 0

for contact in to_append:
    company = contact["company"]
    username = contact["username"]
    page = contact["page"]
    
    if not username:
        skipped += 1
        continue
    
    print(f"  {contact['name']} → {company}...", end=" ")
    
    data = get_sheet_data(page)
    
    # Find row
    row_num = None
    current_comms = ""
    
    for i, row in enumerate(data):
        if row and row[0] and company.lower() in row[0].lower():
            row_num = i + 1
            current_comms = row[3] if len(row) > 3 else ""
            break
    
    if not row_num:
        print("❌ not found")
        continue
    
    # Check duplicate
    new_contact = f"@{username} on TG"
    if username.lower() in current_comms.lower():
        print("⏭️ already there")
        skipped += 1
        continue
    
    # Append
    if current_comms.strip():
        updated = f"{current_comms}, {new_contact}"
    else:
        updated = new_contact
    
    if update_comms_channel(page, row_num, updated):
        print("✅")
        added += 1
    else:
        print("❌ failed")

print(f"\n✅ Added {added} contacts, skipped {skipped}")
