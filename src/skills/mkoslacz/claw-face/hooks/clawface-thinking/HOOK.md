---
name: clawface-thinking
description: "Sets avatar to thinking state at the start of each agent turn"
metadata: {"clawdbot":{"emoji":"🤖","events":["agent:bootstrap"]}}
---

# Avatar Thinking Hook

Automatically sets the clawface to "thinking" state when a new agent turn begins.

This eliminates the delay between the chat showing "typing" and the avatar updating.

## What It Does

On every `agent:bootstrap` event:
1. Writes `{"emotion": "thinking", "action": "thinking", "effect": "brainwave", "message": "..."}` to `~/.moltbot/avatar_state.json`

## Requirements

- clawface must be running
