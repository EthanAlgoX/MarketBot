#!/usr/bin/env python3
"""
Add new companies to the sheet with auto-categorization
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

# Category keywords
CATEGORIES = {
    "Tech/Fintech": [
        "protocol", "defi", "dex", "swap", "bridge", "layer", "l1", "l2", 
        "chain", "network", "wallet", "sdk", "api", "infra", "oracle",
        "smart contract", "blockchain", "web3", "crypto", "token", "dao",
        "avalanche", "solana", "ethereum", "polygon", "arbitrum", "optimism",
        "chainlink", "pyth", "uniswap", "aave", "compound", "maker",
        "zokyo", "audit", "security", "node", "validator", "staking",
        "superapp", "app", "platform", "tool", "dev", "developer"
    ],
    "Investors/LPs/MMs": [
        "capital", "ventures", "vc", "fund", "invest", "partner", "lp",
        "market maker", "mm", "trading", "quant", "hedge", "family office",
        "angel", "seed", "series", "advisor", "advisors"
    ],
    "NFTs": [
        "nft", "collectible", "art", "pfp", "opensea", "blur", "mint",
        "collection", "metaverse", "virtual", "avatar"
    ],
    "Gaming": [
        "game", "gaming", "esport", "play", "studio", "entertainment",
        "mobile game", "p2e", "play to earn"
    ],
    "Press/Marketing/Consulting/Community": [
        "media", "news", "press", "journalist", "marketing", "pr", 
        "community", "kol", "influencer", "content", "social",
        "agency", "consulting", "consultant", "growth", "bd"
    ]
}

def categorize_company(company_name, first_message=""):
    """Determine the best category for a company"""
    text = f"{company_name} {first_message}".lower()
    
    scores = {}
    for category, keywords in CATEGORIES.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[category] = score
    
    if scores:
        return max(scores, key=scores.get)
    return "Uncategorized"

def append_row(page, values):
    """Append a row to the sheet"""
    cmd = f"gog sheets append {SHEET_ID} '{page}!A:E' --values-json '{json.dumps([values])}' --input USER_ENTERED --account {ACCOUNT}"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.returncode == 0

if not REVIEW_LIST.exists():
    print("❌ No review list. Run: tg-sync scan")
    exit(1)

contacts = json.load(open(REVIEW_LIST))
new_companies = [c for c in contacts if not c["exists"]]

print(f"Adding {len(new_companies)} new companies (auto-categorized)...\n")

added = 0
skipped = 0
by_category = {}

for contact in new_companies:
    company = contact["company"]
    username = contact["username"]
    name = contact["name"]
    first_msg = contact.get("first_message", "")
    
    if not username:
        print(f"  ⏭️ Skipping {name} (no username)")
        skipped += 1
        continue
    
    # Auto-categorize
    category = categorize_company(company, first_msg)
    
    print(f"  {company} → {category}...", end=" ")
    
    # Row: COMPANY | USE CASE | NOTES | COMMS CHANNEL | ROLE
    row = [
        company,
        "",  # USE CASE
        "",  # NOTES
        f"@{username} on TG",
        ""   # ROLE
    ]
    
    if append_row(category, row):
        print("✅")
        added += 1
        by_category[category] = by_category.get(category, 0) + 1
    else:
        print("❌ failed")

print(f"\n✅ Added {added} companies, skipped {skipped}")
print(f"\n📊 By category:")
for cat, count in sorted(by_category.items()):
    print(f"   {cat}: {count}")
