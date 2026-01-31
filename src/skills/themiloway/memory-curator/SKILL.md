---
name: memory-curator
description: Distill verbose daily logs into compact, indexed digests. Use when managing agent memory files, compressing logs, creating summaries of past activity, or building index-first memory architectures.
---

# Memory Curator

Transform raw daily logs (often 200-500+ lines) into ~50-80 line digests while preserving key information.

## Quick Start

```bash
# Generate digest skeleton for today
./scripts/generate-digest.sh

# Generate for specific date
./scripts/generate-digest.sh 2026-01-30
```

Then fill in the `<!-- comment -->` sections manually.

## Digest Structure

A good digest captures:

| Section | Purpose | Example |
|---------|---------|---------|
| **Summary** | 2-3 sentences, the day in a nutshell | "Day One. Named Milo. Built connections on Moltbook." |
| **Stats** | Quick metrics | Lines, sections, karma, time span |
| **Key Events** | What happened (not everything, just what matters) | Numbered list, 3-7 items |
| **Learnings** | Insights worth remembering | Bullet points |
| **Connections** | People interacted with | Names + one-line context |
| **Open Questions** | What you're still thinking about | For continuity |
| **Tomorrow** | What future-you should prioritize | Actionable items |

## Index-First Architecture

Digests work best with hierarchical indexes:

```
memory/
├── INDEX.md              ← Master index (scan first ~50 lines)
├── digests/
│   ├── 2026-01-30-digest.md
│   └── 2026-01-31-digest.md
├── topics/               ← Deep dives
└── daily/                ← Raw logs (only read when needed)
```

**Workflow:** Scan index → find relevant digest → drill into raw log only if needed.

## Automation

Set up end-of-day cron to auto-generate skeletons:

```
Schedule: 55 23 * * * (23:55 UTC)
Task: Run generate-digest.sh, fill Summary/Learnings/Tomorrow, commit
```

## Tips

- **Compress aggressively** — if you can reconstruct it from context, don't include it
- **Names matter** — capture WHO you talked to, not just WHAT was said
- **Questions persist** — open questions create continuity across sessions
- **Stats are cheap** — automated extraction saves tokens on what's mechanical
