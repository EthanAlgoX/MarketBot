---
name: youtube-transcript-browser
description: Use browser-backed YouTube adapters to pull transcripts, video metadata, and discussion context from market interviews, conference clips, podcasts, and earnings commentary.
metadata: {"marketbot":{"emoji":"▶️","triggers":["youtube transcript","video transcript","earnings interview","podcast transcript","youtube video"],"output":"youtube-transcript-report","risk":"low","freshness":"live","tools":["browser_site"],"required_tools":["browser_site"],"markets":["global","mixed"],"asset_classes":["equity","crypto","commodity","macro","etf"],"task_type":"browser-research","determinism":"tool-backed","priority":84}}
---

# YouTube Transcript Browser

Use this skill when the user needs transcript-first analysis from a market
video, podcast, interview, conference clip, or earnings discussion.

## Workflow

1. Use `browser_site` with YouTube adapters that exist in the runtime catalog. Prefer exact adapters such as:
   - `youtube/transcript`
   - `youtube/search`
   - `youtube/video`
2. Read [references/adapter-examples.md](references/adapter-examples.md) when you need concrete adapter call patterns or fallback behavior.
3. Extract:
   - key claims
   - management or speaker tone
   - forward-looking guidance or thesis points
4. Pair with `summarize` or `earnings-readout` when the transcript needs a more
   structured write-up.

## Rules

- Prefer `youtube/transcript` when available in the catalog; only fall back to `youtube/video` or `youtube/search` when transcript access is unavailable.
- Do not invent adapter names like `youtube/comments` unless the runtime catalog explicitly exposes them.
- Prefer transcript over title-only interpretation.
- Flag when transcript quality looks incomplete or auto-generated.
