# Douban Adapter Examples

Use only adapters that exist in the runtime catalog.

## Preferred adapters

- `douban/search`
- `douban/movie`
- `douban/top250`

## Typical calls

- Title search:
  `browser_site(adapter="douban/search", args=["哪吒"])`
- Movie detail:
  `browser_site(adapter="douban/movie", args=["<movie-id-or-url>"])`
- List-level context:
  `browser_site(adapter="douban/top250")`

## Fallback rule

- If `douban/movie` is unavailable, use `douban/search` with the title, person, or topic.
- If the runtime catalog does not expose the needed adapter, say so and continue with the closest listed adapter.
