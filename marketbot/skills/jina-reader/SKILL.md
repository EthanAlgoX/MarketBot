---
name: jina-reader
description: Extracts clean, readable markdown content from any URL using the Jina Reader API. Optimized for LLMs to consume web content without clutter.
metadata: {"marketbot":{"emoji":"📄","triggers":["read url","extract markdown","web reader","jina"],"output":"markdown-content","risk":"low","freshness":"live","tools":["web_read"]}}
---

# 📄 Jina Reader

Extract clean, readable markdown content from any URL using the Jina Reader API.

## Usage

To extract content from a specific URL:

```bash
/read "https://example.com/article"
```

## Features

- **LLM Optimized**: Returns clean markdown, removing ads, navigation menus, and boilerplate.
- **Zero Config**: Works out of the box without an API key (higher limits available via `JINA_API_KEY`).
- **Fast**: High-performance extraction for real-time analysis.

---
*Note: This skill enhances MarketBot's ability to analyze external research papers and news articles.*
