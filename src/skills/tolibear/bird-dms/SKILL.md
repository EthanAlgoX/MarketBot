---
name: bird-dm
description: An add-on to the Bird skill that lets your agent check its X/Twitter DM inbox. Use when the user asks to check DMs, read Twitter direct messages, list DM conversations, or monitor their X inbox.
metadata:
  openclaw:
    emoji: "💬"
    requires:
      bins: ["node"]
    install:
      - id: npm
        kind: node
        package: bird-dm
        bins: ["bird-dm"]
        label: "Install bird-dm (npm)"
---

# Bird DM

DM add-on for [bird](https://github.com/steipete/bird) - read your X/Twitter direct messages.

## Install

```bash
npm install -g bird-dm
```

## Commands

```bash
bird-dm inbox              # List DM conversations
bird-dm inbox -n 50        # More conversations
bird-dm inbox --json       # JSON output

bird-dm read <conv-id>     # Read messages
bird-dm read <id> -n 100   # More messages
bird-dm read <id> --json   # JSON output
```

## Example

**List conversations:**
```
💬 @alice, @bob
   ID: 352135192-2015310805076430848
   @alice: hey, check this out
   1/30/2026, 9:15 AM

👥 Project Team
   ID: 1234567890-9876543210
   @carol: meeting at 3pm
   1/30/2026, 8:42 AM
```

**Read messages:**
```
Conversation: 352135192-2015310805076430848

@alice • 1/29/2026, 12:12 PM
hey, wanted to share this article

@bob • 1/29/2026, 2:07 PM
thanks! checking it out now

Showing 2 of 2 messages
```

## Auth

Uses same browser cookies as bird. Run `bird check` to verify your session.
