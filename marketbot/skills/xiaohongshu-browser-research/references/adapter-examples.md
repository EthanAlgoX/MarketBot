# Xiaohongshu Adapter Examples

Use only adapters that exist in the runtime catalog.

## Preferred adapters

- `xiaohongshu/search`
- `xiaohongshu/hot`

## Typical calls

- Keyword search:
  `browser_site(adapter="xiaohongshu/search", args=["lululemon 热度"])`
- Hot topic view:
  `browser_site(adapter="xiaohongshu/hot")`

## Fallback rule

- If `xiaohongshu/hot` is unavailable, use `xiaohongshu/search` with the brand, product, or topic keyword.
- If the runtime catalog does not expose the adapter you need, say so and continue with the closest listed adapter.
