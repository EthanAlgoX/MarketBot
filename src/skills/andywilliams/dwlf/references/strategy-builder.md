# DWLF Strategy Builder — Reference for AI Agents

> This document explains how to create valid visual strategies via the API.
> Strategies are visual graphs (React Flow) that compile into executable trade signals.

## Architecture

```
Visual Graph (nodes + edges) → Compiler → Executable Signal → Evaluator → Trade Signals
```

A strategy is a JSON document with:
- **nodes** — condition checks, logic gates, signals, exits
- **edges** — connections between nodes (directional)
- **pipelines** — entry, exit, cancellation (three separate sub-graphs)

## API

```
POST /v2/visual-strategies        — Create strategy
PUT  /v2/visual-strategies/:id    — Update strategy
GET  /v2/visual-strategies        — List strategies
GET  /v2/visual-strategies/:id    — Get strategy
```

## Strategy JSON Structure

```json
{
  "name": "My Strategy",
  "description": "What it does",
  "isPublic": false,
  "metadata": {
    "timeframe": "1D",
    "assets": ["BTC-USD", "NVDA"],
    "tags": ["trend-following"]
  },
  "visual": {
    "nodes": [ ...allNodes ],
    "edges": [ ...allEdges ],
    "visual": {
      "entry": { "nodes": [...], "edges": [...] },
      "exit": { "nodes": [...], "edges": [...] },
      "cancellation": { "nodes": [...], "edges": [...] }
    }
  }
}
```

The `visual.visual` sub-object partitions nodes/edges by pipeline. The top-level `visual.nodes` and `visual.edges` contain ALL nodes/edges (flat list). Both are needed.

## Pipelines

### Entry Pipeline (required)
Flow: **Start** → Conditions → Logic Gates → **Signal** + **SL** + **TP**

This is the main pipeline. It defines when to enter a trade.

### Exit Pipeline (optional)
Flow: **Exit Start** → Conditions → **Close Position**

Defines when to close an open position.

### Cancellation Pipeline (optional)
Flow: **Cancellation Start** → Conditions → **Cancel**

Defines when to cancel/invalidate a pending setup.

## Node Structure

Every node must have:

```json
{
  "id": "node-1",
  "type": "<reactFlowType>",
  "nodeType": "<logicalType>",
  "label": "Human-readable label",
  "position": { "x": 100, "y": 200 },
  "data": {
    "nodeType": "<logicalType>",
    "pipeline": "entry",
    "label": "Human-readable label",
    "timeframe": "daily",
    "params": {}
  },
  "style": {
    "backgroundColor": "#4a5568",
    "borderColor": "#2d3748",
    "borderRadius": "8px",
    "borderStyle": "solid",
    "borderWidth": "2px",
    "boxShadow": "0 2px 8px rgba(0,0,0,0.15)",
    "color": "white",
    "fontSize": "14px",
    "fontWeight": "500",
    "minWidth": "140px",
    "padding": "12px 16px",
    "textAlign": "center"
  }
}
```

**Important:** Both `nodeType` (top-level) AND `data.nodeType` should be set to the same value for compatibility.

## Node Type Catalog

### Flow Control Nodes

| nodeType | type | Pipeline | Color | Description |
|----------|------|----------|-------|-------------|
| `start` | startNode | entry | `#4ade80` / `#22c55e` | Entry point for entry pipeline |
| `exit_start` | exitStartNode | exit | `#4a5568` / `#2d3748` | Entry point for exit pipeline |
| `cancellation_start` | cancellationStartNode | cancellation | `#f97316` / `#ea580c` | Entry point for cancellation pipeline |

### Condition Nodes (type: `conditionNode`)

All use `backgroundColor: "#4a5568"`, `borderColor: "#2d3748"`.

#### Cycle Conditions
| nodeType | Label |
|----------|-------|
| `cycle.low.developing.33` | Cycle Low (Live) 33% |
| `cycle.low.developing.66` | Cycle Low (Live) 66% |
| `cycle.low.developing.100` | Cycle Low (Live) 100% |
| `cycle.low.confirmed` | Confirmed Cycle Low |
| `cycle.low.provisional` | Provisional Cycle Low |
| `cycle.low.superseded` | Superseded Cycle Low |
| `cycle.low.higher_low` | Cycle Higher Low |
| `cycle.low.lower_low` | Cycle Lower Low |
| `cycle.low.sweep` | Cycle Low Sweep |
| `cycle.high.developing.33` | Cycle High (Live) 33% |
| `cycle.high.developing.66` | Cycle High (Live) 66% |
| `cycle.high.developing.100` | Cycle High (Live) 100% |
| `cycle.high.confirmed` | Confirmed Cycle High |
| `cycle.high.provisional` | Provisional Cycle High |
| `cycle.high.superseded` | Superseded Cycle High |
| `cycle.high.higher_high` | Cycle Higher High |
| `cycle.high.lower_high` | Cycle Lower High |
| `cycle.high.sweep` | Cycle High Sweep |

#### Swing Conditions
| nodeType | Label |
|----------|-------|
| `swing_high` | Swing High |
| `swing_low` | Swing Low |
| `swing_high_break` | Swing High Break |
| `swing_low_break` | Swing Low Break |
| `swing_high_sweep` | Swing High Sweep |
| `swing_low_sweep` | Swing Low Sweep |
| `higher_low` | Higher Low |
| `higher_high` | Higher High |
| `lower_low` | Lower Low |
| `lower_high` | Lower High |

#### EMA Conditions
| nodeType | Label |
|----------|-------|
| `ema_bullish_alignment` | Bullish EMA Alignment |
| `ema_bearish_alignment` | Bearish EMA Alignment |
| `ema_bullish_alignment_sustained` | Bullish EMA Alignment Sustained |
| `ema_bullish_cloud_hit` | Bullish EMA Cloud Hit |
| `ema.cross.above` | Price Crossed Above EMA |
| `ema.cross.below` | Price Crossed Below EMA |
| `closes_above_ema_5` | Closes Above EMA 5 |
| `closes_above_ema_10` | Closes Above EMA 10 |
| `closes_above_ema_20` | Closes Above EMA 20 |
| `closes_below_ema_5` | Closes Below EMA 5 |
| `closes_below_ema_10` | Closes Below EMA 10 |
| `closes_below_ema_20` | Closes Below EMA 20 |
| `price_above_ema` | Price Above EMA |
| `price_below_ema` | Price Below EMA |
| `price_touches_ema` | Price Touches EMA |

#### DSS (Double Smoothed Stochastic) Conditions
| nodeType | Label | Params |
|----------|-------|--------|
| `dss.cross.bullish` | DSS Crossed Above Signal | — |
| `dss.level.overbought` | DSS Entered Overbought Zone | — |
| `dss.level.oversold` | DSS Entered Oversold Zone | — |
| `dss.overbought` | DSS Overbought | — |

#### RSI Conditions
| nodeType | Label | Params |
|----------|-------|--------|
| `rsi.cross.above` | RSI Crossed Above {level} | `{ level: 30 }` or `{ level: 70 }` |

#### Bollinger Band Conditions
| nodeType | Label |
|----------|-------|
| `bollinger.break.belowLower` | Close Broke Below Lower Band |

#### Price / Trend Conditions
| nodeType | Label |
|----------|-------|
| `break_previous_high` | Break Previous High |
| `break_previous_low` | Break Previous Low |
| `bullish_trend_break` | Bullish Trend Break |
| `bearish_trend_break` | Bearish Trend Break |
| `trendline_breach_bullish` | Trendline Breach (Bullish) |
| `trendline_breach_bearish` | Trendline Breach (Bearish) |

#### Volume Conditions
| nodeType | Label |
|----------|-------|
| `atr_expansion` | ATR Expansion |
| `atr_contraction` | ATR Contraction |
| `volume_spike` | Volume Spike |

#### S/R Conditions
| nodeType | Label |
|----------|-------|
| `price.near.support` | Price Near Support |

#### Custom Event Reference
| nodeType | Label | Params |
|----------|-------|--------|
| `custom_event_reference` | {event name} | `{ customEventId: "..." }` |

### Logic Gate Nodes (type: `logicNode`)

| nodeType | Color (bg/border) | Description |
|----------|-------------------|-------------|
| `and_gate` | `#9c27b0` / `#7b1fa2` | ALL inputs must be true |
| `or_gate` | `#9c27b0` / `#7b1fa2` | ANY input must be true |
| `then_gate` | `#9c27b0` / `#7b1fa2` | Sequential: inputs must fire in order |
| `not_gate` | `#9c27b0` / `#7b1fa2` | Negates the input condition |
| `confidence_filter` | `#9c27b0` / `#7b1fa2` | Requires minimum confidence score |

Logic gates accept `data.maxGapDays` (for AND/THEN) to control the time window.

### Signal / Output Nodes (type: `outputNode`)

| nodeType | Color (bg/border) | Description |
|----------|-------------------|-------------|
| `long_signal` | `#4caf50` / `#388e3c` | Generate long (buy) signal |
| `signal` | `#3b82f6` / `#2563eb` | Generic signal (set `data.signalType`) |
| `sl_atr` | `#ff8a65` / `#ff7043` | Stop loss based on ATR |
| `sl_below_recent_low` | `#ff8a65` / `#ff7043` | Stop loss below recent swing low |
| `tp_2r` | `#388e3c` / `#2e7d32` | Take profit at 2:1 R/R |
| `tp_3r` | `#388e3c` / `#2e7d32` | Take profit at 3:1 R/R |
| `tp_5r` | `#388e3c` / `#2e7d32` | Take profit at 5:1 R/R |
| `tp_10r` | `#388e3c` / `#2e7d32` | Take profit at 10:1 R/R |
| `trailingStop` | `#ef4444` / `#dc2626` | Trailing stop (set `data.params.rMultiple`) |

### Exit Nodes

| nodeType | type | Color (bg/border) | Pipeline |
|----------|------|-------------------|----------|
| `close_position` | closePositionNode | `#4a5568` / `#2d3748` | exit |
| `cancel_exit` | exitNode | `#0ea5e9` / `#0284c7` | cancellation |
| `exit` | exitNode | `#ef4444` / `#dc2626` | exit |

## Edge Structure

```json
{
  "id": "edge-{sourceId}-{targetId}",
  "source": "node-1",
  "target": "node-4",
  "sourceHandle": "output",
  "targetHandle": "conditions"
}
```

### Handle Types

| Handle | Used On | Meaning |
|--------|---------|---------|
| `"entry"` | Logic gates | Flow/trigger input (from Start or upstream gate) |
| `"conditions"` | Logic gates | Condition input (from condition nodes) |
| `"output"` | Logic gates, signals | Output to downstream nodes |
| `"input"` | Most nodes | General input |
| `null` | Condition → Gate | Default when no explicit handle |

### Wiring Rules

#### Entry Pipeline
1. **Start** → (output → entry) → **Logic Gate**
2. **Condition Nodes** → (null → conditions) → **Logic Gate**
3. **Logic Gate** → (output → input) → **Signal Node**
4. **Logic Gate/Signal** → (output → input) → **SL Node**
5. **Logic Gate/Signal** → (output → input) → **TP Node**

#### Exit Pipeline
1. **Exit Start** → (null → input) → **Condition Node**
2. **Condition Node** → (null → input) → **Close Position**

Or with logic gates:
1. **Exit Start** → (null → entry) → **Logic Gate**
2. **Conditions** → (null → conditions) → **Logic Gate**
3. **Logic Gate** → (output → input) → **Close Position**

#### Cancellation Pipeline
1. **Cancellation Start** → (null → input) → **Condition Node**
2. **Condition Node** → (null → input) → **Cancel Exit**

## Complete Example — Trend Momentum Strategy

```json
{
  "name": "Trend Momentum",
  "description": "Enter long when EMA crosses bullish AND DSS confirms momentum. Exit on bearish EMA cross. Cancel if DSS overbought.",
  "isPublic": false,
  "metadata": {
    "timeframe": "1D",
    "assets": ["BTC-USD", "NVDA", "AAPL"],
    "tags": ["trend-following", "momentum"]
  },
  "visual": {
    "nodes": [
      {
        "id": "node-1", "type": "startNode", "nodeType": "start",
        "label": "Start", "position": {"x": 150, "y": 50},
        "data": {"nodeType": "start", "pipeline": "entry", "label": "Start"},
        "style": {"backgroundColor": "#4ade80", "borderColor": "#22c55e", "borderRadius": "8px", "borderStyle": "solid", "borderWidth": "2px", "boxShadow": "0 2px 8px rgba(0,0,0,0.15)", "color": "white", "fontSize": "14px", "fontWeight": "500", "minWidth": "140px", "padding": "12px 16px", "textAlign": "center"}
      },
      {
        "id": "node-2", "type": "conditionNode", "nodeType": "ema.cross.above",
        "label": "Price Crossed Above EMA", "position": {"x": 30, "y": 200},
        "data": {"nodeType": "ema.cross.above", "pipeline": "entry", "timeframe": "daily", "label": "Price Crossed Above EMA"},
        "style": {"backgroundColor": "#4a5568", "borderColor": "#2d3748", "borderRadius": "8px", "borderStyle": "solid", "borderWidth": "2px", "boxShadow": "0 2px 8px rgba(0,0,0,0.15)", "color": "white", "fontSize": "14px", "fontWeight": "500", "minWidth": "140px", "padding": "12px 16px", "textAlign": "center"}
      },
      {
        "id": "node-3", "type": "conditionNode", "nodeType": "dss.cross.bullish",
        "label": "DSS Crossed Above Signal", "position": {"x": 280, "y": 200},
        "data": {"nodeType": "dss.cross.bullish", "pipeline": "entry", "timeframe": "daily", "label": "DSS Crossed Above Signal"},
        "style": {"backgroundColor": "#4a5568", "borderColor": "#2d3748", "borderRadius": "8px", "borderStyle": "solid", "borderWidth": "2px", "boxShadow": "0 2px 8px rgba(0,0,0,0.15)", "color": "white", "fontSize": "14px", "fontWeight": "500", "minWidth": "140px", "padding": "12px 16px", "textAlign": "center"}
      },
      {
        "id": "node-4", "type": "logicNode", "nodeType": "and_gate",
        "label": "AND Gate", "position": {"x": 160, "y": 350},
        "data": {"nodeType": "and_gate", "pipeline": "entry", "label": "AND Gate"},
        "style": {"backgroundColor": "#9c27b0", "borderColor": "#7b1fa2", "borderRadius": "8px", "borderStyle": "solid", "borderWidth": "2px", "boxShadow": "0 2px 8px rgba(0,0,0,0.15)", "color": "white", "fontSize": "14px", "fontWeight": "500", "minWidth": "140px", "padding": "12px 16px", "textAlign": "center"}
      },
      {
        "id": "node-5", "type": "outputNode", "nodeType": "long_signal",
        "label": "Long Signal", "position": {"x": 30, "y": 510},
        "data": {"nodeType": "long_signal", "pipeline": "entry", "label": "Long Signal"},
        "style": {"backgroundColor": "#4caf50", "borderColor": "#388e3c", "borderRadius": "8px", "borderStyle": "solid", "borderWidth": "2px", "boxShadow": "0 2px 8px rgba(0,0,0,0.15)", "color": "white", "fontSize": "14px", "fontWeight": "500", "minWidth": "140px", "padding": "12px 16px", "textAlign": "center"}
      },
      {
        "id": "node-6", "type": "outputNode", "nodeType": "sl_atr",
        "label": "SL ATR Based", "position": {"x": 200, "y": 510},
        "data": {"nodeType": "sl_atr", "pipeline": "entry", "label": "SL ATR Based"},
        "style": {"backgroundColor": "#ff8a65", "borderColor": "#ff7043", "borderRadius": "8px", "borderStyle": "solid", "borderWidth": "2px", "boxShadow": "0 2px 8px rgba(0,0,0,0.15)", "color": "white", "fontSize": "14px", "fontWeight": "500", "minWidth": "140px", "padding": "12px 16px", "textAlign": "center"}
      },
      {
        "id": "node-7", "type": "outputNode", "nodeType": "tp_3r",
        "label": "TP 3:1 Risk Reward", "position": {"x": 370, "y": 510},
        "data": {"nodeType": "tp_3r", "pipeline": "entry", "label": "TP 3:1 Risk Reward"},
        "style": {"backgroundColor": "#388e3c", "borderColor": "#2e7d32", "borderRadius": "8px", "borderStyle": "solid", "borderWidth": "2px", "boxShadow": "0 2px 8px rgba(0,0,0,0.15)", "color": "white", "fontSize": "14px", "fontWeight": "500", "minWidth": "140px", "padding": "12px 16px", "textAlign": "center"}
      },
      {
        "id": "node-8", "type": "exitStartNode", "nodeType": "exit_start",
        "label": "Exit Start", "position": {"x": 600, "y": 50},
        "data": {"nodeType": "exit_start", "pipeline": "exit", "label": "Exit Start"},
        "style": {"backgroundColor": "#4a5568", "borderColor": "#2d3748", "borderRadius": "8px", "borderStyle": "solid", "borderWidth": "2px", "boxShadow": "0 2px 8px rgba(0,0,0,0.15)", "color": "white", "fontSize": "14px", "fontWeight": "500", "minWidth": "140px", "padding": "12px 16px", "textAlign": "center"}
      },
      {
        "id": "node-9", "type": "conditionNode", "nodeType": "ema.cross.below",
        "label": "Price Crossed Below EMA", "position": {"x": 570, "y": 200},
        "data": {"nodeType": "ema.cross.below", "pipeline": "exit", "timeframe": "daily", "label": "Price Crossed Below EMA"},
        "style": {"backgroundColor": "#4a5568", "borderColor": "#2d3748", "borderRadius": "8px", "borderStyle": "solid", "borderWidth": "2px", "boxShadow": "0 2px 8px rgba(0,0,0,0.15)", "color": "white", "fontSize": "14px", "fontWeight": "500", "minWidth": "140px", "padding": "12px 16px", "textAlign": "center"}
      },
      {
        "id": "node-10", "type": "closePositionNode", "nodeType": "close_position",
        "label": "Close Position", "position": {"x": 600, "y": 370},
        "data": {"nodeType": "close_position", "pipeline": "exit", "label": "Close Position"},
        "style": {"backgroundColor": "#4a5568", "borderColor": "#2d3748", "borderRadius": "8px", "borderStyle": "solid", "borderWidth": "2px", "boxShadow": "0 2px 8px rgba(0,0,0,0.15)", "color": "white", "fontSize": "14px", "fontWeight": "500", "minWidth": "140px", "padding": "12px 16px", "textAlign": "center"}
      },
      {
        "id": "node-11", "type": "cancellationStartNode", "nodeType": "cancellation_start",
        "label": "Cancellation", "position": {"x": 870, "y": 50},
        "data": {"nodeType": "cancellation_start", "pipeline": "cancellation", "label": "Cancellation"},
        "style": {"backgroundColor": "#f97316", "borderColor": "#ea580c", "borderRadius": "8px", "borderStyle": "solid", "borderWidth": "2px", "boxShadow": "0 2px 8px rgba(0,0,0,0.15)", "color": "white", "fontSize": "14px", "fontWeight": "500", "minWidth": "140px", "padding": "12px 16px", "textAlign": "center"}
      },
      {
        "id": "node-12", "type": "conditionNode", "nodeType": "dss.overbought",
        "label": "DSS Entered Overbought Zone", "position": {"x": 820, "y": 200},
        "data": {"nodeType": "dss.overbought", "pipeline": "cancellation", "timeframe": "daily", "label": "DSS Entered Overbought Zone"},
        "style": {"backgroundColor": "#4a5568", "borderColor": "#2d3748", "borderRadius": "8px", "borderStyle": "solid", "borderWidth": "2px", "boxShadow": "0 2px 8px rgba(0,0,0,0.15)", "color": "white", "fontSize": "14px", "fontWeight": "500", "minWidth": "140px", "padding": "12px 16px", "textAlign": "center"}
      },
      {
        "id": "node-13", "type": "exitNode", "nodeType": "cancel_exit",
        "label": "Cancel", "position": {"x": 870, "y": 370},
        "data": {"nodeType": "cancel_exit", "pipeline": "cancellation", "label": "Cancel"},
        "style": {"backgroundColor": "#0ea5e9", "borderColor": "#0284c7", "borderRadius": "8px", "borderStyle": "solid", "borderWidth": "2px", "boxShadow": "0 2px 8px rgba(0,0,0,0.15)", "color": "white", "fontSize": "14px", "fontWeight": "500", "minWidth": "140px", "padding": "12px 16px", "textAlign": "center"}
      }
    ],
    "edges": [
      {"id": "edge-1-4", "source": "node-1", "target": "node-4", "sourceHandle": null, "targetHandle": "entry"},
      {"id": "edge-2-4", "source": "node-2", "target": "node-4", "sourceHandle": null, "targetHandle": "conditions"},
      {"id": "edge-3-4", "source": "node-3", "target": "node-4", "sourceHandle": null, "targetHandle": "conditions"},
      {"id": "edge-4-5", "source": "node-4", "target": "node-5", "sourceHandle": "output", "targetHandle": "input"},
      {"id": "edge-4-6", "source": "node-4", "target": "node-6", "sourceHandle": "output", "targetHandle": "input"},
      {"id": "edge-4-7", "source": "node-4", "target": "node-7", "sourceHandle": "output", "targetHandle": "input"},
      {"id": "edge-8-9", "source": "node-8", "target": "node-9", "sourceHandle": null, "targetHandle": "input"},
      {"id": "edge-9-10", "source": "node-9", "target": "node-10", "sourceHandle": null, "targetHandle": "input"},
      {"id": "edge-11-12", "source": "node-11", "target": "node-12", "sourceHandle": null, "targetHandle": "input"},
      {"id": "edge-12-13", "source": "node-12", "target": "node-13", "sourceHandle": null, "targetHandle": "input"}
    ],
    "visual": {
      "entry": {
        "nodes": ["(nodes 1-7 from above)"],
        "edges": ["(edges for entry pipeline)"]
      },
      "exit": {
        "nodes": ["(nodes 8-10)"],
        "edges": ["(edges for exit pipeline)"]
      },
      "cancellation": {
        "nodes": ["(nodes 11-13)"],
        "edges": ["(edges for cancellation pipeline)"]
      }
    }
  }
}
```

## Common Patterns

### Simple: One Condition → Signal
```
Start → [entry] AND Gate ← [conditions] Condition
AND Gate → [output→input] Long Signal
AND Gate → [output→input] SL Below Recent Low
AND Gate → [output→input] TP 5R
```

### Two Conditions AND'd
```
Start → [entry] AND Gate
Condition A → [conditions] AND Gate
Condition B → [conditions] AND Gate
AND Gate → Long Signal + SL + TP
```

### Sequential (THEN Gate) — LINEAR CHAIN PATTERN
```
Start → [input] Condition1
Condition1 → [entry] THEN Gate
THEN Gate → [output→input] Condition2
Condition2 → [input] Long Signal
Long Signal → [output→input] SL Node
Long Signal → [output→input] TP Node
```
**IMPORTANT:** THEN gates use a **linear chain**, NOT the `conditions` handle.
- The first condition feeds into the THEN Gate's `entry` handle
- The THEN Gate's `output` feeds into the second condition's `input`
- `maxGapDays` controls the time window (typical values: 30 for indicators, 60-90 for structural)
- Do NOT use `targetHandle: "conditions"` with THEN gates — that's for AND/OR gates only
- **SL and TP nodes ALWAYS connect from the Signal node, NOT from the last condition node**

### OR Gate with Exit
```
Exit Start → [entry] OR Gate
Bearish Condition A → [conditions] OR Gate
Bearish Condition B → [conditions] OR Gate
OR Gate → [output→input] Close Position
```

### WCL-Style (Complex)
```
Start → [entry] AND Gate
  Cycle Low 66% → [conditions] AND Gate
  OR Gate → [conditions] AND Gate
    EMA Bullish → [conditions] OR Gate
    Swing High Break → [conditions] OR Gate
    Higher Low → [conditions] OR Gate
AND Gate → Long Signal + SL Below Recent Low + TP 10R

Exit Start → THEN Gate
  Cycle High 66% → [entry] THEN Gate
  THEN Gate → OR Gate
    Lower High → [conditions] OR Gate
    Swing Low Break → [conditions] OR Gate
    Bearish EMA → [conditions] OR Gate
  OR Gate → Close Position
```

## Key Rules

1. **Every strategy needs a `start` node** — the compiler starts traversal here
2. **Conditions feed into logic gates** via `targetHandle: "conditions"`
3. **Start/flow feeds into logic gates** via `targetHandle: "entry"`
4. **Logic gate outputs** use `sourceHandle: "output"`
5. **Set both `nodeType` and `data.nodeType`** to the same value
6. **Set `data.pipeline`** on every node (`"entry"`, `"exit"`, or `"cancellation"`)
7. **Include at least one signal output** (long_signal or signal) in entry pipeline
8. **Include SL and TP nodes** connected to the **signal node** (long_signal), NOT to the last condition or gate
9. **Node IDs must be unique** — use `node-1`, `node-2`, etc.
10. **Edge IDs must be unique** — use `edge-{source}-{target}` pattern
11. **Position nodes logically** — top to bottom flow, ~150px vertical spacing
12. **The flat `visual.nodes`/`visual.edges` arrays must contain ALL nodes/edges**
