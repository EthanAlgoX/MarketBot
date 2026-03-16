# Stack Overflow Adapter Examples

Use only adapters that exist in the runtime catalog.

## Preferred adapters

- `stackoverflow/search`
- `stackoverflow/thread`

## Typical calls

- Problem search:
  `browser_site(adapter="stackoverflow/search", args=["openai python rate limit"])`
- Thread inspection:
  `browser_site(adapter="stackoverflow/thread", args=["<question-url-or-id>"])`

## Fallback rule

- If `stackoverflow/thread` is unavailable, use `stackoverflow/search` with the API, framework, or error string.
- If the runtime catalog does not expose the needed adapter, say so and continue with the closest listed adapter.
