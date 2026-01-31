#!/usr/bin/env python3
"""
Ultra-strict company detection:
- ONLY "Name | Company" or "Name @ Company" patterns
- ONLY explicit "I work at..." / "I'm from..." in intro
- NO username inference, NO casual mentions
"""

import json
import re
import subprocess
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
CONFIG_FILE = SCRIPT_DIR.parent / ".config.json"
FILTERED_CONTACTS = SCRIPT_DIR / "filtered_contacts.jsonl"
ULTRA_FILTERED = SCRIPT_DIR / "ultra_strict_filtered.jsonl"

# Load config
config = json.loads(CONFIG_FILE.read_text())
SHEET_ID = config["sheet_id"]
GOOGLE_ACCOUNT = config["google_account"]

def get_sheet_usernames():
    """Get existing usernames from all sheet pages"""
    pages = [
        "Tech/Fintech", "Investors/LPs/MMs", "NFTs",
        "Gaming", "Press/Marketing/Consulting/Community", "Uncategorized"
    ]
    
    usernames = set()
    
    for page in pages:
        result = subprocess.run(
            f"gog sheets get {SHEET_ID} '{page}!D:D' --json --account {GOOGLE_ACCOUNT} 2>/dev/null",
            shell=True, capture_output=True, text=True
        )
        
        if result.returncode == 0:
            try:
                data = json.loads(result.stdout)
                for row in data.get("values", []):
                    if row and row[0]:
                        # Extract @usernames
                        for word in row[0].lower().split():
                            if word.startswith("@"):
                                usernames.add(word.lstrip("@"))
            except:
                pass
    
    return usernames

def extract_company_ultra_strict(contact):
    """Only detect if explicitly stated in name or intro"""
    name_full = contact.get("name") or ""
    first_msg = contact.get("first_message") or ""
    
    # Method 1: Name | Company
    if " | " in name_full:
        parts = name_full.split(" | ")
        if len(parts) == 2:
            company = parts[1].strip()
            if not re.search(r'[📍🌍🇦-🇿]', company) and len(company) > 2:
                return company, "name_pipe"
    
    # Method 2: Name @ Company
    if " @ " in name_full:
        parts = name_full.split(" @ ")
        if len(parts) == 2:
            company = parts[1].strip()
            if len(company) > 2:
                return company, "name_at"
    
    # Method 3: Explicit work statement
    intro = first_msg[:200].lower()
    
    work_patterns = [
        r"i work at ([a-z0-9\s]+?)(?:\.|,|\n|$)",
        r"i'm from ([a-z0-9\s]+?)(?:\.|,|\n|$)",
        r"i'm with ([a-z0-9\s]+?)(?:\.|,|\n|$)",
        r"from ([a-z0-9\s]+?)(?:team|here)",
        r"([a-z0-9\s]+?)(team member|developer|engineer)",
    ]
    
    for pattern in work_patterns:
        match = re.search(pattern, intro)
        if match:
            potential = match.group(1).strip()
            if len(potential) > 3 and potential not in ["the", "our", "my", "a", "an"]:
                return potential.title(), "explicit_intro"
    
    return None, None

print("Loading existing contacts from sheet...")
sheet_usernames = get_sheet_usernames()
print(f"Found {len(sheet_usernames)} existing usernames\n")

# Process
results = []
stats = {"total": 0, "in_sheet": 0, "no_company": 0, "has_company": 0}

for line in FILTERED_CONTACTS.read_text().splitlines():
    if not line.strip():
        continue
    
    contact = json.loads(line)
    stats["total"] += 1
    
    # Skip if already in sheet
    username = (contact.get("username") or "").lower()
    if username and username in sheet_usernames:
        stats["in_sheet"] += 1
        continue
    
    # Skip Telegram system
    if contact.get("chat_id") == 777000:
        continue
    
    # Extract company (strict)
    company, source = extract_company_ultra_strict(contact)
    
    if not company:
        stats["no_company"] += 1
        continue
    
    stats["has_company"] += 1
    results.append({
        **contact,
        "detected_company": company,
        "detection_source": source,
    })

# Sort by last active
results.sort(key=lambda x: x.get("last_active") or "", reverse=True)

# Save
with open(ULTRA_FILTERED, "w") as f:
    for r in results:
        f.write(json.dumps(r) + "\n")

print(f"📊 Filter Results:")
print(f"   Total scanned: {stats['total']}")
print(f"   Already in sheet: {stats['in_sheet']}")
print(f"   No company stated: {stats['no_company']}")
print(f"   ✅ With explicit company: {stats['has_company']}")
print(f"\n📄 Output: {ULTRA_FILTERED}")

# Preview
if results:
    print("\n" + "="*50)
    print("TOP 5 DETECTED:")
    print("="*50)
    for i, r in enumerate(results[:5], 1):
        print(f"\n{i}. {r['name']} (@{r.get('username')})")
        print(f"   🏢 {r['detected_company']} (via {r['detection_source']})")
