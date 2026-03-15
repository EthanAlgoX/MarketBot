# Browser Adapter Catalog

This file documents the intended adapter-catalog pattern for MarketBot's
`browser_site` integration.

## Goal

Give the agent a bounded, explicit view of which `bb-browser` adapters are
allowed and expected at runtime.

## Configuration Source

Use `tools.browser.adapterCatalog` in config to list adapters that are safe and
expected in this deployment.

Example:

```json
{
  "tools": {
    "browser": {
      "enabled": true,
      "adapterCatalog": [
        "xueqiu/hot-stock",
        "xueqiu/stock",
        "eastmoney/stock",
        "reddit/search",
        "youtube/transcript",
        "github/search",
        "zhihu/hot"
      ]
    }
  }
}
```

## Recommended Initial Catalog

- `xueqiu/hot-stock`
- `xueqiu/stock`
- `xueqiu/feed`
- `eastmoney/stock`
- `eastmoney/headlines`
- `reddit/search`
- `reddit/thread`
- `youtube/transcript`
- `youtube/search`
- `github/search`
- `github/repo`
- `zhihu/search`
- `zhihu/hot`
- `weibo/search`
- `weibo/hot`
- `bilibili/search`
- `bilibili/video`
- `xiaohongshu/search`
- `xiaohongshu/hot`
- `twitter/search`
- `twitter/thread`
- `hackernews/search`
- `hackernews/thread`
- `douban/search`
- `douban/movie`
- `linkedin/search`
- `linkedin/profile`
- `stackoverflow/search`
- `stackoverflow/thread`
- `wikipedia/search`
- `wikipedia/summary`

## Usage Guidance

- Prefer adapters from this catalog in browser-backed skills.
- Treat catalog membership as a documentation and routing hint.
- Use `allowAdapters` for hard enforcement.
- Use `adapterCatalog` for discoverability and prompt guidance.
