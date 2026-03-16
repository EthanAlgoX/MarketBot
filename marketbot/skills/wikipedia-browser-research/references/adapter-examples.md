# Wikipedia Adapter Examples

Use only adapters that exist in the runtime catalog.

## Preferred adapters

- `wikipedia/search`
- `wikipedia/summary`

## Typical calls

- Entity search:
  `browser_site(adapter="wikipedia/search", args=["semiconductor supply chain"])`
- Direct summary:
  `browser_site(adapter="wikipedia/summary", args=["TSMC"])`

## Fallback rule

- If `wikipedia/summary` is unavailable, use `wikipedia/search` and summarize from the closest entity result.
- If the runtime catalog does not expose the needed adapter, say so and continue with the closest listed adapter.
