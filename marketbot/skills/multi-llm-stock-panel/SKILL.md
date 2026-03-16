---
name: multi-llm-stock-panel
description: Use bb-browser to query Gemini, ChatGPT, and Grok for one-month high-upside US and Hong Kong stock ideas, then verify current prices and synthesize a final ranked summary.
metadata: {"marketbot":{"emoji":"🧠","triggers":["bb-browser","gemini chatgpt grok","multi llm stock panel","future one month upside","一个月内大幅上涨","未来一个月内大涨股票","多模型选股","基本面 市场情绪 趋势 抓机遇"],"output":"multi-llm-stock-panel-report","risk":"high","freshness":"live","tools":["browser_site","market_snapshot"],"required_tools":["browser_site","market_snapshot"],"markets":["hong-kong","us","mixed"],"asset_classes":["equity","etf"],"task_type":"browser-research","determinism":"tool-backed","priority":90}}
---

# Multi-LLM Stock Panel

Use this skill when the user wants a browser-driven idea panel that asks multiple frontier chat models to act like a strong trader and surface the best one-month upside candidates in US and Hong Kong equities.

## When to use

- The user explicitly asks for `bb-browser`.
- The user wants to compare `Gemini`, `ChatGPT`, and `Grok`.
- The user asks for one-month high-upside stocks in US/HK markets.
- The user wants fundamentals, sentiment, trend, and opportunity capture combined into one summary.

## Fixed Browser Targets

Open these exact pages with `bb-browser` / `browser_site`:

1. `https://aistudio.google.com/prompts/new_chat?model=gemini-3.1-pro-preview`
2. `https://chatgpt.com/`
3. `https://grok.com/`

If one site is unavailable, blocked, logged out, or unusable, continue with the remaining sites and state the gap.

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

1. Use `bb-browser` / `browser_site` to open the three fixed targets.
2. Submit the fixed prompt to each model.
3. Extract only the structured candidate fields:
   - symbol
   - company name
   - thesis
   - claimed current price
   - target price
   - upside probability
   - risks
4. Deduplicate overlapping picks across Gemini, ChatGPT, and Grok.
5. Use `market_snapshot` to verify the current price for every final candidate.
6. If a model-provided current price conflicts with live market data, use live market data and explicitly mark the model claim as stale.
7. Produce a single ranked summary of the best ideas.

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
```

## Rules

- Do not trust model-reported current prices without `market_snapshot` verification.
- Do not summarize vague sectors when the prompt asks for concrete stocks.
- If browser interaction fails on any of the three sites, say which panel was unavailable.
- If the models return too many names, compress to the highest-conviction 3-5 names.
- Keep the final summary decision-oriented and concise.
