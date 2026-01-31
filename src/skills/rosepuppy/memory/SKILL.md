---
name: memory
description: Complete memory system for OpenClaw agents. Combines behavioral protocol (when to save) + auto-capture (heartbeat-enforced) + keyword search (recall) + maintenance (consolidation). Use for persistent memory, context recovery, answering "what did we discuss about X", and surviving context compaction. Includes SESSION-STATE.md pattern for hot context and RECENT_CONTEXT.md for auto-updated highlights.
---

# Memory Skill

A complete memory system that actually works. Not just tools — a full protocol.

## The Problem

Agents forget. Context compresses. You wake up fresh each session. 

Most memory solutions give you tools but no protocol for WHEN to use them. You forget to remember.

## The Solution

**The Flow:**
```
User message → auto-capture (heartbeat) → relevant memories loaded (recall) → respond with context
```

**Three layers:**
1. **Protocol** — WHEN to save (on user input, not agent memory)
2. **Capture** — HOW to extract (automatic, timer-enforced)
3. **Recall** — HOW to find (keyword search with time decay)
4. **Maintenance** — HOW to prune (consolidation)

## Quick Setup

### 1. Copy templates to your workspace

```bash
cp skills/memory/references/SESSION-STATE.md ./
cp skills/memory/references/RECENT_CONTEXT.md ./
```

### 2. Add protocol to your AGENTS.md

Add this to your agent instructions:

```markdown
### 🔄 MEMORY PROTOCOL (MANDATORY)

**Before Responding to Context Questions:**
When user asks about past discussions, decisions, or preferences:
1. FIRST run: `python3 skills/memory/scripts/recall.py "user's question"`
2. READ the results (they're now in your context)
3. THEN respond using that context

**After Substantive Conversations:**
Run: `python3 skills/memory/scripts/capture.py --facts "fact1" "fact2"`

**Write-Ahead Log Rule:**
If user provides concrete detail (name, correction, decision), update SESSION-STATE.md BEFORE responding.
```

### 3. Add auto-capture to HEARTBEAT.md

```markdown
## Memory Auto-Capture (EVERY HEARTBEAT)
1. If meaningful conversation since last capture:
   - Run: `python3 skills/memory/scripts/capture.py --facts "fact1" "fact2"`
   - Update RECENT_CONTEXT.md with highlights
   - Update SESSION-STATE.md if task changed
```

## Commands

### Capture

Store facts from conversations:

```bash
# Specific facts (recommended)
python3 scripts/capture.py --facts "Bill prefers X" "Decided to use Y" "TODO: implement Z"

# Raw text (auto-extracts)
python3 scripts/capture.py "conversation text here"

# From file
python3 scripts/capture.py --file /path/to/conversation.txt
```

### Recall

Search memory for relevant context:

```bash
python3 scripts/recall.py "what did we decide about the database"
python3 scripts/recall.py --recent 7 "Bill's preferences"  # last 7 days only
```

Returns snippets with timestamps and relevance scores. Recent memories score higher.

### Consolidate

Run periodic maintenance:

```bash
python3 scripts/consolidate.py           # full consolidation
python3 scripts/consolidate.py --stats   # just show statistics
python3 scripts/consolidate.py --dry-run # preview without changes
```

Finds duplicates, identifies stale memories, suggests MEMORY.md updates.

## File Structure

```
your-workspace/
├── SESSION-STATE.md      # Hot context (active task "RAM")
├── RECENT_CONTEXT.md     # Auto-updated recent highlights
├── MEMORY.md             # Curated long-term memory
└── memory/
    ├── 2026-01-30.md     # Daily log
    ├── 2026-01-29.md     # Daily log
    └── topics/           # (optional) Category files
```

## SESSION-STATE.md Pattern

This is your "RAM" — the active task context that survives compaction.

```markdown
# SESSION-STATE.md — Active Working Memory

## Current Task
[What you're working on RIGHT NOW]

## Immediate Context
[Key details, decisions, corrections from this session]

## Key Files
[Paths to relevant files]

## Last Updated
[Timestamp]
```

**Read it FIRST** at every session start. Update it when task context changes.

## Fact Categories

Capture extracts facts with categories:

- `[decision]` — choices made
- `[preference]` — user likes/dislikes
- `[todo]` — action items
- `[insight]` — learnings
- `[important]` — flagged as critical
- `[note]` — general notes

## Limitations

- **Keyword search** — not semantic (LanceDB integration planned)
- **Behavioral component** — you still need to follow the protocol
- **No auto-injection** — recall results require you to call the script

## What Makes This Different

| Other Skills | Memory Skill |
|--------------|--------------|
| Tools only | Protocol + tools |
| Manual trigger | Heartbeat auto-capture |
| No templates | SESSION-STATE.md pattern |
| Just storage | Storage + search + maintenance |

## Roadmap

- [ ] LanceDB semantic search (local, no API)
- [ ] Auto-injection into context (OpenClaw integration)
- [ ] Contradiction detection
- [ ] Memory analytics

---

*Built by g1itchbot. Dogfooded on myself first.*
