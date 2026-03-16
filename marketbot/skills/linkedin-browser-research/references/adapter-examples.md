# LinkedIn Adapter Examples

Use only adapters that exist in the runtime catalog.

## Preferred adapters

- `linkedin/search`
- `linkedin/profile`

## Typical calls

- Company or people search:
  `browser_site(adapter="linkedin/search", args=["OpenAI research engineer"])`
- Profile or company page:
  `browser_site(adapter="linkedin/profile", args=["<profile-or-company-url>"])`

## Fallback rule

- If `linkedin/profile` is unavailable, use `linkedin/search` with the company, team, or role query.
- If the runtime catalog does not expose the needed adapter, say so and continue with the closest listed adapter.
