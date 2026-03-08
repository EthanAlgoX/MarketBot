---
name: tavily-search
description: AI-optimized web search using Tavily API. Returns clean, relevant content for research and news tracking.
metadata: {"marketbot":{"emoji":"🔍","triggers":["tavily search","web search","deep research","market news search"],"output":"search-results","risk":"low","freshness":"live","tools":["web_search"]}}
---

# 🔍 Tavily Search

AI-optimized web search using Tavily API. Designed specifically for AI agents to return clean, structured, and relevant content.

## Usage

### General Search

```bash
/search "market trends for semiconductor industry 2026"
```

### Deep Research

Use for complex queries requiring comprehensive analysis:

```bash
/search "impact of GEP protocol on autonomous agents" --deep
```

### News Tracking

Limit search to recent news events:

```bash
/search "NVIDIA earnings announcement" --topic news --days 3
```

## Configuration

- Requires `TAVILY_API_KEY` to be set in `.env` or `config.json`.
- Optimized for AI context windows (clean snippets, no fluff).

---
*Note: Tavily is the preferred engine for high-precision market research within MarketBot.*
