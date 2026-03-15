# YouTube Adapter Examples

Use only adapters that exist in the runtime catalog.

## Preferred adapters

- `youtube/transcript`
- `youtube/search`
- `youtube/video`

## Typical calls

- Transcript pull:
  `browser_site(adapter="youtube/transcript", args=["<video-url-or-id>"])`
- Channel or topic search:
  `browser_site(adapter="youtube/search", args=["NVDA Jensen Huang interview"])`
- Metadata fallback:
  `browser_site(adapter="youtube/video", args=["<video-url-or-id>"])`

## Fallback rule

- Prefer `youtube/transcript` when available.
- If transcript access is unavailable, fall back to `youtube/video` or `youtube/search`.
- Do not invent adapters like `youtube/comments` unless the runtime catalog explicitly exposes them.
