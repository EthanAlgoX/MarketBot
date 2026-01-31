---
name: focus-mode
description: Help users stay focused on a specific goal or task. Activate with "/focus <goal>" to set a focus target. Monitors conversation for drift and gently redirects back to the focus area. Use when user wants accountability, has ADHD-style workflows, tends to go down rabbit holes, or explicitly asks to stay on track. Deactivate with "/focus off".
---

# Focus Mode

Keep users on track toward their stated goal by detecting conversation drift and providing gentle nudges.

## Activation

When user says `/focus <goal>`:
1. Store the focus goal in `~/.config/clawdbot-focus/current.json`
2. Acknowledge: "ð¯ Focus mode ON: *{goal}*. I'll help keep you on track."
3. Note the start time

When user says `/focus off` or `/focus done`:
1. Calculate session duration and drift stats
2. Show summary: time spent, tangents parked, redirects given
3. Clear the focus state

When user says `/focus` (no args):
1. Show current focus if active, or prompt to set one

## Drift Detection

After each user message, evaluate:

**On-topic signals:**
- Directly relates to the focus goal
- Asks for help with a subtask of the goal
- Reports progress on the goal
- Asks clarifying questions about the goal

**Drift signals:**
- Completely unrelated topic introduced
- Deep dive into tangent that doesn't serve the goal
- Scope creep ("while we're at it, let's also...")
- Procrastination patterns ("actually, first let me...")

## Response Patterns

**Light drift (related but tangential):**
- Continue helping, but add: "*(Noting this as a side thread â we can circle back after {goal})*"

**Medium drift (unrelated topic):**
- Help briefly, then: "Want me to park this for later? Still have *{goal}* on deck."

**Heavy drift (extended tangent, 3+ exchanges off-topic):**
- Direct but kind: "We've drifted a bit from *{goal}*. Ready to refocus, or is this tangent worth pursuing?"

**Time-based nudge (30+ min on tangent):**
- "You've been on this for a while. Still serving the main goal, or should we context-switch back?"

## Parking Lot

When user says "park this" or you suggest parking a tangent:
1. Append to `~/.config/clawdbot-focus/parked.json`: `{topic, timestamp, context}`
2. Confirm: "Parked: *{topic}*. Will remind you after focus session."

After `/focus off`, list parked items:
```
ð Parked tangents:
â¢ Research that API library (from 20min ago)
â¢ Check Discord notification settings
```

## Tone Modes

User can set tone with `/focus tone <mode>`:

- **gentle** (default): Soft suggestions, doesn't interrupt flow
- **strict**: More direct, shorter leash on tangents  
- **accountability**: Includes time pressure ("You said by 9pm, it's 8:30")

## State File Format

`~/.config/clawdbot-focus/current.json`:
```json
{
  "goal": "Ship Alithos news page",
  "started": "2026-01-30T21:22:00Z",
  "tone": "gentle",
  "deadline": null,
  "redirects": 0,
  "tangent_time_sec": 0
}
```

## Session Summary

On `/focus off` or `/focus done`:
```
ð¯ Focus session complete!

Goal: Ship Alithos news page
Duration: 1h 42m
On-task: ~78%
Redirects: 3
Parked: 2 tangents

Nice work staying focused! ð
```

## Integration Notes

- Works alongside other skills â doesn't block anything
- Drift detection runs passively, doesn't slow responses
- State persists across session restarts via JSON file
- Can be combined with Pomodoro-style timers if user requests
