---
name: slk
description: Read, send, search, and manage Slack messages via the slk CLI. Use when the user asks to check Slack, read channels, send Slack messages, search Slack, check unreads, manage drafts, or interact with Slack workspace. Also use for heartbeat Slack checks.
---

# slk — Slack CLI

Session-based Slack CLI for macOS. Auto-authenticates from the Slack desktop app (no tokens or app installs needed).

**Requires:** `slk` installed (`npm i -g slkcli`), Slack desktop app running on macOS.

## Commands

```bash
# Auth
slk auth                              # Test authentication

# Read
slk channels                          # List channels (alias: ch)
slk read <channel> [count]            # Read recent messages (alias: r)
slk thread <channel> <ts> [count]     # Read a thread (alias: t)
slk search <query> [count]            # Search messages
slk users                             # List workspace users (alias: u)

# Activity
slk activity                          # All channels with unread indicators (alias: a)
slk unread                            # Only channels with unreads, excludes muted (alias: ur)
slk starred                           # VIP users + starred items (alias: star)
slk saved [count] [--all]             # Saved for later items (alias: sv)
slk pins <channel>                    # Pinned items in a channel (alias: pin)

# Write
slk send <channel> <message>          # Send a message (alias: s)
slk react <channel> <ts> <emoji>      # React to a message

# Drafts (synced to Slack editor)
slk draft <channel> <message>         # Draft a channel message
slk draft thread <ch> <ts> <message>  # Draft a thread reply
slk draft user <user_id> <message>    # Draft a DM
slk drafts                            # List active drafts
slk draft drop <draft_id>             # Delete a draft
```

Channel accepts name (`ai-coding`) or ID (`C08A8AQ2AFP`).

## Auth

Auth is automatic — extracts session token from Slack desktop app's LevelDB + decrypts cookie from macOS Keychain. Caches working token in `~/.local/slk/token-cache.json`.

**First run:** macOS will show a Keychain dialog asking to allow access to "Slack Safe Storage". Choose "Allow" (one-time) or "Always Allow" (permanent, no future prompts). "Always Allow" is convenient but means any process running as your user can extract credentials silently.

If auth fails: ensure Slack desktop app is running. If token rotated, delete cache and retry:
```bash
rm ~/.local/slk/token-cache.json
slk auth
```

## Known Limitations

- **macOS only** — uses Keychain + Electron storage paths.
- **Draft drop** may fail with `draft_has_conflict` if Slack desktop has that conversation open. Navigate away in Slack first.
- **Session token** expires if user logs out of Slack. Keep app running.

## Heartbeat Usage

For periodic Slack checks, use `slk unread` to get channels with unreads (respects mute settings). Follow up with `slk read <channel>` for channels that need attention.
