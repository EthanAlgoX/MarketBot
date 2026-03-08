---
name: multi-search-engine
description: Aggregates search results from multiple privacy-focused and professional search engines (DuckDuckGo, Startpage, Brave, Qwant, WolframAlpha, etc.). Supports advanced time filters and specialized query operators.
metadata: {"marketbot":{"emoji":"🌐Sync","triggers":["multi-search","global search","privacy search","wolfram","advanced research"],"output":"global-search-report","risk":"low","freshness":"live","tools":["web_search"]}}
---

# 🌐 Multi-Search Engine

A powerful aggregator that pulls results from various privacy-first and professional search engines. Ideal for cross-referencing information and deep research across multiple sources.

## Features

- **Multi-Engine Aggregation**: Search across DuckDuckGo, Startpage, Brave, and Qwant simultaneously.
- **WolframAlpha Integration**: Solve math problems, convert currencies, and get structured facts.
- **Advanced Operators**: Support for exact matches (+), exclusions (-), and site-specific searches.
- **Time Filtering**: Quickly filter results by the past hour, day, week, month, or year.

## Usage

### Simple Multi-Search

```bash
/multi-search "market share of EV in China 2025"
```

### Advanced Research with Exclusions

```bash
/multi-search "semiconductor pricing -ASMC"
```

### WolframAlpha Facts

```bash
/multi-search "100 USD to CNY"
/multi-search "MSFT stock"
```

### Time-Sensitive Search (Past Week)

```bash
/multi-search "latest Fed rate hike news tbs=qdr:w"
```

## Privacy & Safety

- **No Tracking**: Uses privacy-focused engines by default.
- **Independent Index**: Accesses Brave's independent search index for diverse viewpoints.

---
*Note: This skill integrates the OpenClaw multi-search infrastructure into MarketBot for superior global research capabilities.*
