---
name: multi-llm-stock-panel
description: Use browser-backed tools to query Gemini, ChatGPT, and Grok for one-month high-upside US and Hong Kong stock ideas, then verify current prices and synthesize a final ranked summary.
metadata: {"marketbot":{"emoji":"🧠","triggers":["bb-browser","gemini chatgpt grok","multi llm stock panel","future one month upside","一个月内大幅上涨","未来一个月内大涨股票","多模型选股","基本面 市场情绪 趋势 抓机遇"],"output":"multi-llm-stock-panel-report","risk":"high","freshness":"market-live","tools":["browser_page","browser_site","market_snapshot"],"required_tools":["browser_page","market_snapshot"],"markets":["hong-kong","us","mixed"],"asset_classes":["equity","etf"],"task_type":"browser-research","determinism":"tool-backed","priority":90}}
---

# Multi-LLM Stock Panel

Use this skill when the user wants a browser-driven idea panel that asks multiple frontier chat models to act like a strong trader and surface the best one-month upside candidates in US and Hong Kong equities.

Treat `bb-browser` as the runtime browser capability exposed through MarketBot tools. If `browser_page` or `browser_site` is available, use those tools directly and do not speculate about raw CLI availability.

## When to use

- The user explicitly asks for `bb-browser`.
- The user wants to compare `Gemini`, `ChatGPT`, and `Grok`.
- The user asks for one-month high-upside stocks in US/HK markets.
- The user wants fundamentals, sentiment, trend, and opportunity capture combined into one summary.

## Fixed Browser Targets

Open these exact pages with `browser_page`:

1. `https://aistudio.google.com/prompts/new_chat?model=gemini-3.1-pro-preview`
2. `https://chatgpt.com/`
3. `https://grok.com/`

If one site is unavailable, blocked, logged out, or unusable, continue with the remaining sites and state the gap. Partial results are acceptable.

## Fixed Prompt

Send this prompt to each model with only minimal market/date adaptation if needed:

```text
作为团队中最擅长分析基本面、市场情绪、趋势、抓机遇的交易员，分析美股和港股里未来一个月内最有可能大幅上涨的股票。请给出每个候选的：
1. 股票代码
2. 股票名称
3. 核心上涨逻辑
4. 当前股价
5. 一个月目标价
6. 上涨概率（百分比）
7. 主要风险

优先输出 3-5 只最强候选，分别覆盖美股和港股。不要给泛泛而谈的行业观点，要给具体股票。
```

## Workflow

1. Use `browser_page(action="open", target=...)` to open the three fixed targets and record the returned `tabId` for each newly opened page.
2. Work only against those fresh `tabId` values. Ignore older pre-existing tabs for the same site.
3. Process the panels in this fixed order exactly once: Gemini, then ChatGPT, then Grok.
4. For each fresh tab, run `browser_page(action="snapshot", tab=...)` first to capture the current interactive refs.
5. If the snapshot is empty or has no usable refs, refresh/re-open that page and retry snapshot once before declaring the panel unavailable.
6. Identify the message composer ref from that snapshot, then use `browser_page(action="fill", target="<ref>", value="...prompt...", tab=...)`.
7. Submit with `browser_page(action="click", ...)` on the send button if a clear send button ref exists; otherwise use `browser_page(action="press", value="Enter", tab=...)`.
8. Poll for a response at most twice for each panel. If the page shows login requirements, missing API key, or still no answer after two checks, mark that panel unavailable and move on.
9. After Grok is checked, stop the browser workflow immediately. Do not go back to Gemini or ChatGPT for another pass.
10. Extract only the structured candidate fields:
   - symbol
   - company name
   - thesis
   - claimed current price
   - target price
   - upside probability
   - risks
11. Deduplicate overlapping picks across Gemini, ChatGPT, and Grok.
12. Use `market_snapshot` to verify the current price for every final candidate.
13. If a model-provided current price conflicts with live market data, use live market data and explicitly mark the model claim as stale.
14. Produce a single ranked summary of the best ideas.

## Ranking Rules

Rank final candidates using:

- cross-model agreement
- clarity of catalyst inside one month
- trend strength
- sentiment tailwind
- price target asymmetry

Bias toward names supported by at least two of the three models.

## Output Format

```md
# Multi-LLM Stock Panel

## Top Candidates

| Rank | Symbol | Name | Market | Live Price | 1M Target | Upside Prob. | Backed By |
|------|--------|------|--------|------------|-----------|--------------|-----------|

## Candidate Notes

### <SYMBOL>
- Core thesis:
- Why it can move within one month:
- Risks:
- Model agreement:

## Model Comparison
- Gemini:
- ChatGPT:
- Grok:

## Final View
- Best US idea:
- Best HK idea:
- Highest-conviction overall idea:

## Panel Availability
- Gemini:
- ChatGPT:
- Grok:
```

## Rules

- Do not trust model-reported current prices without `market_snapshot` verification.
- Do not say "bb-browser is unavailable" when `browser_page` is available in the tool list.
- Do not use `exec` to run raw `bb-browser` commands when `browser_page` is available.
- Refs from `snapshot` are only valid for the current page state. Always take a fresh snapshot before `fill` or `click`.
- When working across multiple tabs, always pass the tab id on every browser action so you do not act on the wrong page.
- Never spend more than 1 open + 1 retry snapshot + 1 submit + 2 response checks on any single panel.
- If only one panel responds, still return a report using that single panel and mark the other panels unavailable.
- If no panels respond, stop and report the exact panel availability state instead of burning more tool iterations.
- If no panels respond, do not fall back to `market_snapshot`, `market_news`, or any other substitute analysis flow. Report failure of the requested multi-panel workflow directly.
- Never start a second pass across the panels. One ordered sweep only.
- Once a panel is marked unavailable, do not reopen it, revisit it, or search for alternate old tabs from the same site.
- Do not summarize vague sectors when the prompt asks for concrete stocks.
- If browser interaction fails on any of the three sites, say which panel was unavailable.
- If the models return too many names, compress to the highest-conviction 3-5 names.
- Keep the final summary decision-oriented and concise.
