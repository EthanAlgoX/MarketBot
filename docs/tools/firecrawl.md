---
summary: "Firecrawl fallback for web_fetch (anti-bot + cached extraction)"
read_when:
  - You want Firecrawl-backed web extraction
  - You need a Firecrawl API key
  - You want anti-bot extraction for web_fetch
---

# Firecrawl

MarketBot can use **Firecrawl** as a fallback extractor for `web_fetch`. It is a hosted
content extraction service that supports bot circumvention and caching, which helps
with JS-heavy sites or pages that block plain HTTP fetches.

## Get an API key

1) Create a Firecrawl account and generate an API key.
2) Store it in config or set `FIRECRAWL_API_KEY` in the gateway environment.

## Configure Firecrawl

```json5
{
  tools: {
    web: {
      fetch: {
        strategy: "waterfall", // optional: "fast" | "waterfall" | "race"
        firecrawl: {
          apiKey: "FIRECRAWL_API_KEY_HERE",
          baseUrl: "https://api.firecrawl.dev",
          onlyMainContent: true,
          maxAgeMs: 172800000,
          timeoutSeconds: 60,
          proxy: "auto", // optional: "auto" | "basic" | "stealth"
          storeInCache: true // optional
        }
      }
    }
  }
}
```

Notes:
- `firecrawl.enabled` defaults to true when an API key is present.
- `maxAgeMs` controls how old cached results can be (ms). Default is 2 days.

## Stealth and cache behavior

Firecrawl exposes a **proxy mode** parameter for bot circumvention (`basic`, `stealth`, or `auto`).
MarketBot defaults to `proxy: "auto"` and `storeInCache: true`, and both can be overridden in config.
If proxy is omitted, Firecrawl defaults to `auto`. `auto` may escalate to stealth fetches, which can use more credits than basic-only scraping.

## How `web_fetch` uses Firecrawl

`web_fetch` extraction order:
1) `strategy: "waterfall"` (default): native fetch/readability, then Firecrawl, then browser fallback.
2) `strategy: "fast"`: native fetch only for transport/HTTP failures; Firecrawl is only used when readability extraction fails.
3) `strategy: "race"`: after native fetch fails, Firecrawl and browser fallback run in parallel; first success wins.

See [Web tools](/tools/web) for the full web tool setup.
