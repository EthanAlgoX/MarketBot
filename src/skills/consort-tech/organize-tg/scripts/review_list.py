#!/usr/bin/env python3
"""
Generate review list with sheet cross-reference
"""

import json
import re
import subprocess
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
CONFIG_FILE = SCRIPT_DIR.parent / ".config.json"
ULTRA_FILTERED = SCRIPT_DIR / "ultra_strict_filtered.jsonl"
REVIEW_LIST = SCRIPT_DIR / "review_list.json"

# Load config
config = json.loads(CONFIG_FILE.read_text())
SHEET_ID = config["sheet_id"]
GOOGLE_ACCOUNT = config["google_account"]

PAGES = [
    "Tech/Fintech", "Investors/LPs/MMs", "NFTs",
    "Gaming", "Press/Marketing/Consulting/Community", "Uncategorized"
]

def load_sheet_companies():
    """Load company names from all pages"""
    companies = {}
    
    for page in PAGES:
        result = subprocess.run(
            f"gog sheets get {SHEET_ID} '{page}!A:A' --json --account {GOOGLE_ACCOUNT} 2>/dev/null",
            shell=True, capture_output=True, text=True
        )
        
        if result.returncode == 0:
            try:
                data = json.loads(result.stdout)
                for row in data.get("values", [])[1:]:
                    if row and row[0]:
                        company = row[0].strip()
                        companies[company.lower()] = (page, company)
            except:
                pass
    
    return companies

# False positive patterns
FALSE_POSITIVES = {"ooo until", "out of office", "docker", "you are looking for"}

def is_false_positive(company):
    company_lower = company.lower()
    for fp in FALSE_POSITIVES:
        if fp in company_lower:
            return True
    if re.search(r'[📍🌍🥷🏄🟢]', company):
        return True
    return False

print("Loading sheet companies...")
sheet_companies = load_sheet_companies()
print(f"Found {len(sheet_companies)} companies\n")

# Process
valid_contacts = []

if not ULTRA_FILTERED.exists():
    print("❌ No filtered contacts. Run scan first.")
    exit(1)

for line in ULTRA_FILTERED.read_text().splitlines():
    if not line.strip():
        continue
    
    contact = json.loads(line)
    company = contact["detected_company"]
    
    if is_false_positive(company):
        continue
    
    # Check if company exists
    company_lower = company.lower()
    exists = False
    page = None
    
    for sheet_company_lower, (sheet_page, sheet_name) in sheet_companies.items():
        if company_lower in sheet_company_lower or sheet_company_lower in company_lower:
            exists = True
            page = sheet_page
            company = sheet_name
            break
    
    valid_contacts.append({
        "name": contact["name"],
        "username": contact.get("username"),
        "company": company,
        "exists": exists,
        "page": page,
        "first_message": contact.get("first_message", "")[:100]
    })

# Sort: existing first
valid_contacts.sort(key=lambda x: (not x["exists"], x["company"]))

print(f"{'#':<4} {'NAME':<25} {'USERNAME':<18} {'COMPANY':<25} {'ACTION'}")
print("="*85)

for i, c in enumerate(valid_contacts, 1):
    action = f"→ {c['page']}" if c["exists"] else "🆕 NEW"
    username = f"@{c['username']}" if c["username"] else "-"
    print(f"{i:<4} {c['name'][:24]:<25} {username[:17]:<18} {c['company'][:24]:<25} {action}")

print("="*85)
print(f"\nTotal: {len(valid_contacts)}")
print(f"  Append to existing: {sum(1 for c in valid_contacts if c['exists'])}")
print(f"  Add as new: {sum(1 for c in valid_contacts if not c['exists'])}")

# Save
REVIEW_LIST.write_text(json.dumps(valid_contacts, indent=2))
print(f"\n📄 Saved: {REVIEW_LIST}")
