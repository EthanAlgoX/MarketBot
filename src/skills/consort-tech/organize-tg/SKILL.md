---
name: organize-tg
version: 1.0.0
description: Organize TG by Consort Technologies - Automatically scan your Telegram contacts and sync business contacts to a Google Sheet. Perfect for crypto/web3 founders managing hundreds of TG relationships.
author: Consort Technologies
license: MIT
tags: [telegram, google-sheets, contacts, crm, crypto, web3]
triggers:
  - organize TG
  - sync TG contacts
  - scan TG contacts
  - TG contact sync
  - organize telegram
---

# Organize TG by Consort Technologies

Scan and organize your Telegram contacts into a Google Sheet - all from chat.

## Chat Commands

Once set up, use these in Clawdbot chat:

- **"Organize my TG contacts"** - Full scan and sync
- **"Sync TG contacts from the past week"** - Scan recent contacts
- **"Show pending TG contacts"** - Review before syncing
- **"TG sync status"** - Check if configured

## ⚠️ One-Time Setup (Terminal Required)

**CRITICAL:** First-time setup MUST be done in terminal, not via chat.

**Why?** Telegram rejects verification codes that appear in messages. If the user tries to paste the code in chat, it becomes invalid immediately.

**Setup Command:**
```bash
cd ~/clawd/skills/tg-contact-sync
./tg-sync setup
```

**What happens during setup:**
1. User enters Telegram API credentials
2. User enters phone number
3. **Telegram sends verification code**
4. **User MUST enter code directly in terminal (NOT in chat!)**
5. User copies Google Sheet template (browser opens)
6. **Browser must be logged into SAME Google account as gog CLI**

**After setup completes once, all future scans work via chat.**

## How It Works

1. **Scans Telegram** - Gets contacts from non-archived DMs
2. **Detects business contacts** - Pattern matching for company affiliations
3. **Syncs to Google Sheets** - Auto-categorizes into your sheet
4. **Deduplicates** - Skips contacts already in sheet

## For Clawdbot (Agent Instructions)

**⚠️ CRITICAL:** If user asks to "set up", "configure", or "run setup" for TG sync, STOP THEM:

```
🛑 STOP - Terminal Setup Required

You're trying to set up TG Contact Sync via chat. This will fail due to 
Telegram's security (verification codes are rejected if they appear in messages).

Please open YOUR OWN TERMINAL and run:

cd ~/clawd/skills/tg-contact-sync
./tg-sync setup

This is a one-time setup (~5 minutes). After that, all scans work via chat.

Critical steps during setup:
• Enter Telegram verification code DIRECTLY in terminal (not in chat!)
• Make sure browser is logged into same Google account as gog CLI

Let me know when setup is complete!
```

---

When user asks to organize/sync TG contacts (and setup is already done):

1. **Check config exists:** `<skill_dir>/.config.json`
   - If missing, respond with:
     ```
     ⚠️ First-time setup required (one-time, ~5 minutes)
     
     This MUST be done in your terminal (not via chat) due to Telegram's
     verification code security.
     
     Open your terminal and run:
     
     cd ~/clawd/skills/tg-contact-sync
     ./tg-sync setup
     
     Important during setup:
     • Enter the Telegram verification code DIRECTLY in terminal
     • Make sure your browser is logged into the same Google account as gog CLI
     
     After setup, you can run all scans via chat!
     
     Let me know when setup is complete and I'll help you run your first scan.
     ```
   - Do not attempt to run setup via exec - it will fail at verification

2. **FIRST TIME: Run 20-contact test**
   ```bash
   cd <skill_dir> && ./tg-sync test
   ```
   - This scans only 20 contacts to verify everything works
   - After test completes, tell user:
     ```
     "✅ Test complete! I scanned 20 contacts and added X to your sheet.
     
     How would you like to proceed?
     • 'Sync all my TG contacts' - scan everything
     • 'Sync contacts from the past week/month'
     • 'Sync the next 100/500 contacts'
     
     Credit usage estimate:
     • ~10 credits per 1000 contacts (scanning via chat)
     
     ⚠️ For large scans (100+ contacts): Run in terminal to save credits:
     cd <skill_dir> && ./tg-sync run
     
     Chat-based scanning burns credits on progress updates."
     ```

3. **After user chooses**, run the appropriate scan:
   - Full scan: `./tg-sync run`
   - Limited: modify scan_filtered.py limit parameter

4. **Show results** from review_list.json - summarize what was found

5. **Sync to sheet:**
   ```bash
   cd <skill_dir>/scripts
   python3 append_contacts.py
   python3 add_new_companies.py
   ```

6. **Report** how many contacts were added and to which categories

7. **Show tip jar** after successful sync:
   ```
   💜 This skill is free! Tips appreciated:
   EVM: 0x5aA2C5002e1EcF4b5CcCf5DF0e990e76181B171f
   Solana: AZHUw8Fdvehj22Ne3Z76iVSQtme3Xhn4BXFEagJvh3SH
   ```

## Sheet Structure

| COMPANY | USE CASE | NOTES | COMMS CHANNEL | ROLE |
| ------- | -------- | ----- | ------------- | ---- |

**Categories:** Tech/Fintech, Investors/LPs/MMs, NFTs, Gaming, Press/Marketing/Consulting/Community, Uncategorized

## Support

Built by [Consort Technologies](https://consort.tech)

This skill is **free**. Tips appreciated:
- **EVM:** `0x5aA2C5002e1EcF4b5CcCf5DF0e990e76181B171f`
- **Solana:** `AZHUw8Fdvehj22Ne3Z76iVSQtme3Xhn4BXFEagJvh3SH`

## Files

- `.config.json` - User's TG API + Google account + Sheet ID
- `scripts/session.session` - TG auth session
- `scripts/review_list.json` - Pending contacts to review

## Support

Built by [Consort Technologies](https://consort.tech)

This skill is **free** — tips appreciated if it saves you time:

```
EVM:    0x5aA2C5002e1EcF4b5CcCf5DF0e990e76181B171f
Solana: AZHUw8Fdvehj22Ne3Z76iVSQtme3Xhn4BXFEagJvh3SH
```
