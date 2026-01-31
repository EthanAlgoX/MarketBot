---
summary: "CLI reference for `marketbot voicecall` (voice-call plugin command surface)"
read_when:
  - You use the voice-call plugin and want the CLI entry points
  - You want quick examples for `voicecall call|continue|status|tail|expose`
---

# `marketbot voicecall`

`voicecall` is a plugin-provided command. It only appears if the voice-call plugin is installed and enabled.

Primary doc:
- Voice-call plugin: [Voice Call](/plugins/voice-call)

## Common commands

```bash
marketbot voicecall status --call-id <id>
marketbot voicecall call --to "+15555550123" --message "Hello" --mode notify
marketbot voicecall continue --call-id <id> --message "Any questions?"
marketbot voicecall end --call-id <id>
```

## Exposing webhooks (Tailscale)

```bash
marketbot voicecall expose --mode serve
marketbot voicecall expose --mode funnel
marketbot voicecall unexpose
```

Security note: only expose the webhook endpoint to networks you trust. Prefer Tailscale Serve over Funnel when possible.

