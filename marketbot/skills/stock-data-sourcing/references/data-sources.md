# Data Source Matrix

This reference condenses the reusable data-source design from `../daily_stock_analysis`.

## Coverage Matrix

| Task | Primary | Fallbacks | Notes |
| --- | --- | --- | --- |
| A-share realtime quote | `tickflow` | `efinance` -> `akshare_em` -> `akshare_sina` / `akshare_qq` -> `pytdx` | `tickflow` is now the preferred API-backed realtime path inside `marketbot`; free endpoints remain useful fallback options. |
| A-share daily history | `tushare` when token exists, else `efinance` | `akshare` -> `pytdx` -> `baostock` | `tushare` gets promoted to highest priority when token is valid. |
| A-share ETF history | `efinance` / `tushare` | `akshare` -> `yfinance` | ETF prefixes are handled explicitly. |
| Hong Kong daily history | `akshare stock_hk_hist` | `yfinance` | `daily_stock_analysis` has explicit HK support in `AkshareFetcher`. |
| Hong Kong realtime quote | `akshare stock_hk_spot_em` | `yfinance` | Good free fallback for `hk00700`-style symbols. |
| US stocks history and realtime | `yfinance` | none in-project beyond search/news fallback | `daily_stock_analysis` intentionally avoids Akshare for US adjusted history. |
| US indices | `yfinance` | none | Uses symbol mapping like `SPX -> ^GSPC`. |
| Chip distribution | `akshare` | none | Strong A-share-specific enrichment. |
| Company base info / board membership | `efinance` | none | Useful for background, sector, and valuation context. |
| China market indices | `efinance` / `akshare` / `tushare` | `yfinance` only as a coarse fallback | Suitable for daily market review. |
| Sector rankings / market breadth | `efinance` / `akshare` / `tushare` | none | Best used for A-share breadth and rotation. |
| Chinese financial news | `Bocha` | `Tavily` -> `SerpAPI` | `Bocha` is preferred for Chinese search quality. |
| Global / US news | `Brave` | `Tavily` -> `SerpAPI` | `Brave` is better for English/global coverage. |
| Browser-authenticated site context | `browser_site` | native APIs first, browser lane second | Use for Xueqiu, Eastmoney, Reddit, Zhihu, or other dynamic / logged-in pages when public APIs are insufficient. |

## Runtime Routing Extracted From `daily_stock_analysis`

### Market data manager

- `DataFetcherManager` orders sources dynamically.
- If `TUSHARE_TOKEN` is configured and API init succeeds, `tushare` is promoted above `efinance`.
- US stocks and US indices are routed directly to `yfinance`.
- A-share and ETFs walk a fallback chain instead of failing hard on the first provider.

### Search service

- Search providers initialize in this order:
  1. `Bocha`
  2. `Tavily`
  3. `Brave`
  4. `SerpAPI`
- News freshness defaults to `3` days.
- Query windows shrink on weekdays and widen on Monday/weekends, but stay capped by `news_max_age_days`.

### Multi-dimensional intel workflow

`daily_stock_analysis` searches these dimensions for a stock:

1. `latest_news`
2. `market_analysis`
3. `risk_check`
4. `earnings`
5. `industry`

That is the most reusable part for `marketbot`: it turns raw search into a structured catalyst pack instead of a flat headline dump.

## Recommended `marketbot` Mapping

### What can be reused immediately

- `market-report`
- `catalyst-tracker`
- `risk-checklist`
- `stock-info-explorer` for Yahoo-based charts

### What should become future tools or connectors

- `a_share_quote` backed by `efinance` / `tushare`
- `a_share_chip_distribution` backed by `akshare`
- `china_market_breadth` backed by `efinance` / `akshare`

### What is already mapped in current marketbot tools

- `market_snapshot` now supports `tickflow`, `eastmoney`, `yahoo`, `auto`, and `mock`
- `market_chip_distribution` now estimates A-share chip structure from Eastmoney daily kline and turnover
- `market_fundamentals` now loads lightweight profile/share-cap fields from TickFlow for A-share when configured, otherwise Eastmoney for mainland symbols and Yahoo quote for global symbols
- `market_news` now supports cross-market routing across `Bocha`, `Brave`, `Tavily`, `SerpAPI`, Google RSS, and `mock`
- `market_source_plan` explains which provider chain should be used for each market/task combination

## Selection Heuristics

- Use `tushare` when structure and stability matter more than free access.
- Use `efinance` when you need broad A-share coverage, base info, or batch realtime quotes.
- Use `akshare` when you need HK coverage, chip distribution, or alternate China endpoints.
- Use `pytdx` when free direct CN quote infrastructure is needed as a fallback.
- Use `baostock` for stable, simple A-share historical fallback where T+1 delay is acceptable.
- Use `yfinance` for US stocks, US indices, and cross-market last-resort compatibility.
- Use `Bocha` for Chinese market news.
- Use `Brave` for US/global market news.
- Use `browser_site` only when site-native or login-state context adds material value.

## Caveats

- Eastmoney-family sources are powerful but rate-limit and anti-bot behavior are real.
- `yfinance` is convenient but not execution-grade.
- `baostock` is stable but delayed.
- Provider choice should be disclosed in user-facing analysis when it affects freshness or confidence.
