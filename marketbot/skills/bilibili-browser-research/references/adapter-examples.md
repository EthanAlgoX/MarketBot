# Bilibili Adapter Examples

Use only adapters that exist in the runtime catalog.

## Preferred adapters

- `bilibili/search`
- `bilibili/video`
- `bilibili/comments`

## Typical calls

- Topic search:
  `browser_site(adapter="bilibili/search", args=["英伟达 财报"])`
- Single video:
  `browser_site(adapter="bilibili/video", args=["<video-url-or-id>"])`
- Comments scan:
  `browser_site(adapter="bilibili/comments", args=["<video-url-or-id>"])`

## Fallback rule

- If `bilibili/comments` is unavailable, use `bilibili/video` and mark comment-level evidence as unavailable.
- If the runtime catalog does not expose the needed adapter, say so and fall back to the closest listed adapter.
