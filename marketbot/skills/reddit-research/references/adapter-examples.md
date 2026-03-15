# Reddit Adapter Examples

Use only adapters that exist in the runtime catalog.

## Preferred adapters

- `reddit/search`
- `reddit/hot`
- `reddit/thread`

## Typical calls

- Topic search:
  `browser_site(adapter="reddit/search", args=["NVDA earnings"])`
- Subreddit heat:
  `browser_site(adapter="reddit/hot", args=["wallstreetbets"])`
- Single thread:
  `browser_site(adapter="reddit/thread", args=["<thread-url-or-id>"])`

## Fallback rule

- If `reddit/thread` is unavailable, use `reddit/search` with the ticker, theme, or headline.
- If the runtime catalog does not expose the adapter you want, say so and use the closest listed adapter instead.
