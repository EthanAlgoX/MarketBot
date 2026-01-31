# telegram-reaction-prober

A small Clawdbot skill (documentation + procedure + starter emoji sets) for probing which emoji reactions are accepted in a Telegram chat.

Why: Telegram reactions can be restricted per-chat; unsupported emoji yields `400 REACTION_INVALID`.

This skill shares the *method* and *candidate emoji lists* — the final allow/deny list is always chat-specific.

See `SKILL.md` for the runbook.
