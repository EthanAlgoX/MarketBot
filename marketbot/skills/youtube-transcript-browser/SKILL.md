---
name: youtube-transcript-browser
description: Use browser-backed YouTube adapters to pull transcripts, video metadata, and discussion context from market interviews, conference clips, podcasts, and earnings commentary.
metadata: {"marketbot":{"emoji":"▶️","triggers":["youtube transcript","video transcript","earnings interview","podcast transcript","youtube video"],"output":"youtube-transcript-report","risk":"low","freshness":"live","tools":["browser_site"],"required_tools":["browser_site"],"markets":["global","mixed"],"asset_classes":["equity","crypto","commodity","macro","etf"],"task_type":"browser-research","determinism":"tool-backed","priority":84}}
---

# YouTube Transcript Browser

Use this skill when the user needs transcript-first analysis from a market
video, podcast, interview, conference clip, or earnings discussion.

## Workflow

1. Use `browser_site` with YouTube adapters such as:
   - `youtube/transcript`
   - `youtube/search`
   - `youtube/video`
2. Extract:
   - key claims
   - management or speaker tone
   - forward-looking guidance or thesis points
3. Pair with `summarize` or `earnings-readout` when the transcript needs a more
   structured write-up.

## Rules

- Prefer transcript over title-only interpretation.
- Flag when transcript quality looks incomplete or auto-generated.
