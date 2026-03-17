# Browser Adapter Catalog

This file documents the adapter-catalog pattern for MarketBot's
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
- `eastmoney/news`
- `reddit/search`
- `reddit/thread`
- `youtube/transcript`
- `youtube/search`
- `github/repo`
- `zhihu/search`
- `zhihu/hot`
- `weibo/post`
- `weibo/user_posts`
- `weibo/hot`
- `bilibili/search`
- `bilibili/video`
- `bilibili/comments`
- `xiaohongshu/search`
- `xiaohongshu/note`
- `twitter/search`
- `twitter/thread`
- `twitter/user`
- `hackernews/top`
- `hackernews/thread`
- `douban/search`
- `douban/movie`
- `linkedin/search`
- `linkedin/profile`
- `stackoverflow/search`
- `wikipedia/search`
- `wikipedia/summary`

## Real Adapter Families Installed Locally

On this machine, `bb-browser site update` currently installs adapters for these
site families:

- `36kr`
- `arxiv`
- `baidu`
- `bbc`
- `bilibili`
- `bing`
- `boss`
- `cnblogs`
- `csdn`
- `ctrip`
- `devto`
- `douban`
- `duckduckgo`
- `eastmoney`
- `genius`
- `github`
- `google`
- `gsmarena`
- `hackernews`
- `hupu`
- `imdb`
- `jike`
- `linkedin`
- `npm`
- `openlibrary`
- `producthunt`
- `pypi`
- `qidian`
- `reddit`
- `reuters`
- `smzdm`
- `sogou`
- `stackoverflow`
- `toutiao`
- `twitter`
- `v2ex`
- `weibo`
- `wikipedia`
- `xiaohongshu`
- `xueqiu`
- `yahoo-finance`
- `youdao`
- `youtube`
- `zhihu`

## Real Smoke Status

These are real runs observed on this workstation on 2026-03-17.

### Verified Working

- `wikipedia/summary`
- `reddit/search`
- `youtube/search`
- `zhihu/hot`
- `yahoo-finance/quote`
- `xueqiu/hot-stock`

### Verified Through MarketBot Tooling

- `BrowserSiteTool -> wikipedia/summary`

### Present But Currently Requires Browser State

- `eastmoney/news`
  Current behavior: `Failed to fetch`; adapter hints to open and log in to `https://www.eastmoney.com`
- `github/repo`
  Current behavior: adapter hints to open and log in to `https://github.com`
- `hackernews/top`
  Current behavior: adapter hints to open `https://news.ycombinator.com`
- `arxiv/search`
  Current behavior: adapter hints to open `https://arxiv.org`

## Usage Guidance

- Prefer adapters from this catalog in browser-backed skills.
- Treat catalog membership as both a routing hint and a runtime execution boundary.
- When `adapterCatalog` is non-empty, `browser_site` only allows adapters listed in the catalog.
- Use `allowAdapters` and `allowSites` as secondary constraints or as fallback boundaries when no catalog is configured.
- Keep the catalog intentionally small and aligned with the specialist skills you actually support.
