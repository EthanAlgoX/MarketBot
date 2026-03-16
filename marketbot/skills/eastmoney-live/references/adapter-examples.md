# Eastmoney Adapter Examples

Use only adapters that exist in the runtime catalog.

## Preferred adapters

- `eastmoney/stock`
- `eastmoney/headlines`

## Typical calls

- Stock page context:
  `browser_site(adapter="eastmoney/stock", args=["000001"])`
- Headline or newsflash check:
  `browser_site(adapter="eastmoney/headlines", args=["宁德时代"])`

## Fallback rule

- If `eastmoney/headlines` is unavailable, use `eastmoney/stock` and note that only page-level context is available.
- If the runtime catalog does not expose the needed adapter, say so and continue with the closest listed adapter.
