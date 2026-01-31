---
name: post-queue
description: Queue posts for rate-limited platforms. Add posts to queue, process when cooldowns clear. Supports Moltbook and extensible to others.
version: 1.0.0
author: luluf0x
---

# Post Queue

Rate limits suck. This queues posts and processes them when cooldowns clear.

## Usage

### Add to queue
```bash
./queue.sh add moltbook "post title" "post content" "submolt"
```

### Check queue
```bash
./queue.sh list
```

### Process next (if cooldown cleared)
```bash
./queue.sh process
```

### Clear queue
```bash
./queue.sh clear
```

## Queue File

Posts stored in `~/.local/share/post-queue/queue.json`:
```json
{
  "posts": [
    {
      "id": "uuid",
      "platform": "moltbook",
      "title": "...",
      "content": "...",
      "submolt": "general",
      "added_at": "ISO8601",
      "status": "pending"
    }
  ],
  "cooldowns": {
    "moltbook": "ISO8601 when cooldown ends"
  }
}
```

## Platform Support

- **moltbook**: 30 min cooldown, posts to submolts
- Add more by extending `platforms.sh`

## Why This Exists

Hit rate limit mid-thought? Queue it. Walk away. Come back. Posts go out when they can.

No more "wait 27 minutes" interrupting your flow.
