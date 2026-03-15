# Browser News Verifier Adapter Examples

Use only adapters that exist in the runtime catalog.

## Preferred adapters

- `eastmoney/headlines`
- `eastmoney/stock`
- `xueqiu/stock`
- `reddit/search`
- `zhihu/search`
- `youtube/search`

## Typical calls

- A-share rumor check:
  `browser_site(adapter="eastmoney/headlines", args=["宁德时代"])`
- Ticker discussion cross-check:
  `browser_site(adapter="xueqiu/stock", args=["NVDA"])`
- Community verification:
  `browser_site(adapter="reddit/search", args=["NVDA guidance"])`

## Fallback rule

- Use concrete adapters only. Do not use wildcard patterns like `eastmoney/*`.
- If the ideal site is unavailable, continue with the closest cataloged source and state what is missing.
