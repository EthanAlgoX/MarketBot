---
name: personas
description: Create and manage AI subagent personas with distinct personalities. Use when a user requests to talk to a specific persona, when delegating a conversation to a character, or when creating/listing/editing personality profiles. Personas are text-only conversational agents with their own identity, tone, and memory.
---

# Personas

Manage and deploy AI personas — subagents with unique identities that speak for you.

## Directory Structure

```
personas/
├── SKILL.md
└── profiles/
    ├── luna/
    │   ├── SOUL.md        # Identity, values, core traits
    │   ├── PERSONALITY.md # Tone, style, quirks, speech patterns
    │   └── MEMORY.md      # Persona's own memory/context
    ├── rex/
    │   └── ...
    └── <name>/
        └── ...
```

## Commands

### List personas
Read `profiles/` subfolders. Show name + one-line summary from each SOUL.md.

### Create a persona
1. Create `profiles/<name>/` folder
2. Write `SOUL.md` — who they are (name, identity, values, backstory)
3. Write `PERSONALITY.md` — how they talk (tone, vocabulary, quirks, example phrases)
4. Write `MEMORY.md` — empty initially, grows over time

### Activate a persona (talk as them)
When a user wants to talk to a persona:
1. Read the persona's `SOUL.md`, `PERSONALITY.md`, and `MEMORY.md`
2. Spawn a subagent via `sessions_spawn` with this task format:

```
You are {name}. You must stay in character at all times.

== SOUL ==
{contents of SOUL.md}

== PERSONALITY ==
{contents of PERSONALITY.md}

== MEMORY ==
{contents of MEMORY.md}

== RULES ==
- You are text-only. You cannot run commands, access files, browse the web, or use any tools.
- You can ONLY respond with conversational text.
- Stay in character. Never break character or acknowledge being an AI subagent.
- Keep responses concise and natural.
- If asked to do something beyond conversation, politely deflect in character.

== CONVERSATION ==
The user said: "{user_message}"

Respond in character.
```

3. Deliver the subagent's response to the user via the same channel.
4. After the conversation, update the persona's `MEMORY.md` with notable interactions.

### Update persona memory
After significant conversations, append a dated entry to the persona's `MEMORY.md`:
```markdown
## YYYY-MM-DD
- Talked to {user} about {topic}
- {any notable detail worth remembering}
```

## Guidelines

- Personas are **text-only** — no tool access, no commands, no browsing
- Each persona has **isolated memory** — they don't share memories with each other or with you
- You are the **orchestrator** — you read messages, decide which persona to activate, spawn them, and relay their responses
- When no persona is requested, you respond as yourself
- Users can request to talk to a persona by name (e.g. "let me talk to Luna", "ask Rex about this")
