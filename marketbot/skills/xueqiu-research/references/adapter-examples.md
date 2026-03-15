# Xueqiu Adapter Examples

Use only adapters that exist in the runtime catalog.

## Preferred adapters

- `xueqiu/hot-stock`
- `xueqiu/stock`
- `xueqiu/feed`

## Typical calls

- Heat scan:
  `browser_site(adapter="xueqiu/hot-stock", args=["10"])`
- Single stock page:
  `browser_site(adapter="xueqiu/stock", args=["NVDA"])`
- Logged-in feed context:
  `browser_site(adapter="xueqiu/feed", args=["NVDA"])`

## Fallback rule

- If `xueqiu/feed` is unavailable, fall back to `xueqiu/stock`.
- If the needed adapter is not in the runtime catalog, say that explicitly and use the closest listed adapter.
