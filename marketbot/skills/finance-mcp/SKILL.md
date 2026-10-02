---
name: finance-mcp
description: Use configured financial MCP tools to supplement native market research with verified financial data, fundamentals, news, and macro evidence.
metadata: {"marketbot":{"emoji":"🔌","triggers":["MCP financial data","finance MCP","financial MCP","财务数据补充","金融 MCP","金融MCP","MCP 财务数据"],"output":"financial-data-evidence","risk":"medium","freshness":"reference","tools":["market_source_plan","market_snapshot","market_fundamentals","market_news","market_macro"],"markets":["global","mixed"],"task_type":"financial-data-research","determinism":"tool-backed","priority":75}}
---

# Financial MCP Research

Use native market tools first for MarketBot research. The default local finance
MCP server exposes the same market data service to compatible MCP clients;
calling both interfaces does not provide independent corroboration.

## Default read-only capabilities

| MCP tool | Capability |
| --- | --- |
| `mcp_finance_market_source_plan` | Market coverage, source routing, and fallbacks |
| `mcp_finance_market_snapshot` | Current quotes and market snapshot evidence |
| `mcp_finance_market_fundamentals` | Company profile and valuation inputs |
| `mcp_finance_market_news` | Recent financial news and source references |
| `mcp_finance_market_macro` | Macro indicators and regime context |
| `mcp_finance_market_event_extract` | Extract an event from supplied headline evidence |
| `mcp_finance_market_social_sentiment` | Discussion sentiment and its reliability limits |
| `mcp_finance_market_chip_distribution` | A-share chip distribution and cost structure |
| `mcp_finance_portfolio_risk` | Deterministic cross-currency holdings value, concentration, and assumed stress scenarios |
| `mcp_finance_evidence_get` | Retrieve and verify an immutable workspace research record |
| `mcp_finance_evidence_list` | Inspect recorded evidence and claim bindings |
| `mcp_finance_logic_chain_visualizer` | Render a supplied reasoning chain as Markdown and Mermaid |

## Workflow

1. Identify the asset, exchange, currency, requested period, and data field.
2. Prefer the native `market_*` tool or `portfolio_risk` covering the request. Use the corresponding
   MCP capability when that interface is available or another MCP client is used.
3. Use external financial MCP tools only when enabled and present in the current
   tool catalog, especially for fields not covered by the native service.
   Alpha Vantage is an optional preset, disabled by default; it requires its
   configured runtime command and `ALPHA_VANTAGE_API_KEY` before use.
4. Report the returned observation time, source, currency, units, and any delay
   or warning. Keep tool transport details out of ordinary investment answers.
5. Reconcile conflicting sources and distinguish verified values, model
   estimates, mock data, synthetic sentiment, and unavailable fields.

Never invent prices, financial statements, news, or successful MCP connections.
If a field is unavailable, state the gap and use an available documented
fallback. A running MCP connection does not establish that its market data is
live, fresh, or complete. These capabilities provide research data and do not
execute trades or move funds.
