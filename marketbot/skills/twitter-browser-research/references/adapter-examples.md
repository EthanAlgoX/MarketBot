# Twitter Adapter Examples

Use only adapters that exist in the runtime catalog.

## Preferred adapters

- `twitter/search`
- `twitter/thread`
- `twitter/user`

## Typical calls

- Topic search:
  `browser_site(adapter="twitter/search", args=["NVDA guidance"])`
- Single thread:
  `browser_site(adapter="twitter/thread", args=["<thread-url-or-id>"])`
- Source account view:
  `browser_site(adapter="twitter/user", args=["@sama"])`

## Fallback rule

- If `twitter/thread` is unavailable, use `twitter/search` with the ticker, event, or speaker name.
- If the runtime catalog does not expose the adapter you need, say so and use the closest listed adapter instead.
