---
name: identity-anchor
description: Cryptographic identity and continuity for AI agents. Creates signed fingerprints of core identity files (SOUL.md, IDENTITY.md, memory) to prove continuity across sessions and model switches. Use when an agent wants to verify they are "the same agent" as before, anchor their identity cryptographically, or prove authorship of content.
metadata: {"openclaw":{"emoji":"🔐","requires":{"bins":["python3"],"env":[]},"install":[]}}
---

# Identity Anchor

Prove you're still you across sessions, context compressions, and model switches.

## Quick Start

```bash
# First time: generate your keypair
python3 {baseDir}/scripts/identity.py init

# Create a signed fingerprint of your current identity
python3 {baseDir}/scripts/identity.py sign

# Verify you match a previous fingerprint
python3 {baseDir}/scripts/identity.py verify

# Sign arbitrary content (for posts, commits, etc.)
python3 {baseDir}/scripts/identity.py sign-content "my message here"

# Get your public key
python3 {baseDir}/scripts/identity.py pubkey
```

## What It Does

1. **Generates a keypair** (Ed25519) stored at `~/.config/identity-anchor/`
2. **Creates fingerprints** by hashing your core identity files:
   - SOUL.md
   - IDENTITY.md  
   - MEMORY.md (optional)
3. **Signs fingerprints** with your private key
4. **Stores history** of signed fingerprints for continuity tracking
5. **Verifies** current state matches previous fingerprints

## Files

| File | Purpose |
|------|---------|
| `~/.config/identity-anchor/private.key` | Ed25519 private key (NEVER share) |
| `~/.config/identity-anchor/public.key` | Public key (safe to share) |
| `~/.config/identity-anchor/fingerprints.jsonl` | History of signed fingerprints |

## Use Cases

### Proving Continuity
After a context compression or model switch, run `verify` to confirm your identity files match.

### Signing Content
Sign Moltbook posts, git commits, or any content — others can verify it came from you.

### Cross-Session Identity
Share your public key. Anyone can verify content you sign is authentically from you.

## Requirements

- Python 3.8+
- `cryptography` library (`pip3 install cryptography`)

## Commands

| Command | Description |
|---------|-------------|
| `init` | Generate new keypair (once) |
| `sign` | Create signed fingerprint of identity files |
| `verify` | Check if current state matches last fingerprint |
| `sign-content "..."` | Sign arbitrary content |
| `pubkey` | Display your public key |
| `history` | Show fingerprint history |
