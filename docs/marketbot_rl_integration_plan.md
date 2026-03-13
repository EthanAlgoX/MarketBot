# MarketBot RL Integration Plan

## Goal

Integrate a reinforcement learning pipeline into MarketBot by reusing the
useful abstractions from `/Users/yunxuanhan/Documents/workspace/ai/OpenClaw-RL`
while replacing terminal-task assumptions with market/backtest semantics.

The target is not "train a generic terminal agent inside MarketBot". The target
is:

1. optimize MarketBot's market-analysis and trade-decision policy,
2. keep the current skill-first runtime intact,
3. make rollout, evaluation, and training asynchronous,
4. support both offline backtest training and later online feedback learning.

## What Exists Today

MarketBot already has the right serving surface:

- runtime loop and session orchestration in `marketbot/agent/loop.py`
- tool abstraction in `marketbot/agent/tools/base.py`
- tool registry and schema validation in `marketbot/agent/tools/registry.py`
- market-domain tool/plugin registration in `marketbot/domain/market/plugin.py`
- market data and routing services in `marketbot/domain/market/services.py`
- a heuristic signal generator in `marketbot/agent/tools/market.py`

The current gap is that `market_signal` is still a fixed weighted heuristic. It
does not learn from:

- realized PnL
- drawdown and turnover penalties
- user feedback on analysis quality
- tool-usage quality during multi-step market research

## What To Reuse From OpenClaw-RL

OpenClaw-RL should be treated as an architecture reference, not copied as-is.

Reusable ideas:

1. asynchronous split of serving, rollout collection, judging, and training
2. environment protocol with `allocate`, `reset`, `exec_tool`, `evaluate`,
   `close`
3. per-turn interaction logging and sample building
4. PRM-based step scoring for tool-using agents
5. remote worker pool for parallel environment execution

Relevant reference files:

- `OpenClaw-RL/terminal-rl/env_client.py`
- `OpenClaw-RL/terminal-rl/generate.py`
- `OpenClaw-RL/terminal-rl/agent_runner.py`
- `OpenClaw-RL/terminal-rl/agent/prm_agent.py`
- `OpenClaw-RL/terminal-rl/remote/pool_server.py`

Do not directly reuse:

- terminal-task dataset format
- Docker-terminal execution assumptions
- Megatron/Slime-specific training bootstrap as a hard dependency in MarketBot

Those parts are too heavy for the current MarketBot codebase and solve a
different environment.

## Recommended Architecture

### 1. Keep MarketBot Runtime As The Online Serving Layer

Do not rewrite `AgentLoop`. Keep it as the production inference path and add an
RL capture layer around it.

Add a new package:

```text
marketbot/rl/
  __init__.py
  types.py
  recorder.py
  dataset.py
  reward.py
  prm.py
  policy.py
  env/
    __init__.py
    api.py
    market_env.py
    worker.py
  trainer/
    __init__.py
    adapter.py
```

Responsibilities:

- `recorder.py`: persist trajectory, tool calls, observations, final outcome
- `dataset.py`: convert replay logs into RL/SFT/PRM datasets
- `reward.py`: compute financial rewards and risk penalties
- `prm.py`: step-level evaluator for market research quality
- `policy.py`: switch between heuristic and RL-backed policy outputs
- `env/market_env.py`: backtest environment implementing OpenClaw-like lease API
- `trainer/adapter.py`: thin adapter to external trainer stack

### 2. Replace "Terminal Environment" With "Market Environment"

Implement a market environment that mirrors the OpenClaw-RL worker contract:

- `allocate(task_key, request_id)`
- `reset(lease_id, task_meta, run_ctx, task_timeouts)`
- `exec_tool(lease_id, tool_call)`
- `evaluate(lease_id)`
- `close(lease_id)`

But the semantics change:

- `task_key`: symbol/universe + date window + objective
- `reset`: load historical market snapshot at time `t0`
- `exec_tool`: only expose safe market-analysis tools
- `evaluate`: compute reward from the next step / episode outcome
- `close`: release backtest state

The environment should support two modes:

1. `analysis-only`
   Optimize report quality, tool selection, evidence coverage, and user feedback.
2. `decision`
   Optimize actual trade actions, sizing, exits, and holding logic.

### 3. Introduce A Smaller Tool Set For RL Rollouts

Do not expose the full MarketBot tool registry during RL training. That makes
credit assignment noisy and lets the agent overfit to irrelevant tools.

Create an RL-safe tool subset:

- `market_snapshot`
- `market_news`
- `market_macro`
- `market_fundamentals`
- `market_chip_distribution` where applicable
- `portfolio_state` (new)
- `submit_trade_action` (new)
- `advance_time` (new)

Do not allow during rollouts:

- filesystem tools
- shell execution
- outbound messaging
- cron
- arbitrary web fetch unless explicitly wrapped as a market-source tool

### 4. Separate Policy Optimization From Final User-Facing Wording

MarketBot is both an analyst and an assistant. If the same policy is trained
end-to-end on raw user-facing responses, reward becomes unstable.

Split the optimization target into two policies:

1. `decision policy`
   Chooses action, size, stop, invalidation, and optional tool sequence.
2. `response policy`
   Formats the explanation and report for the user.

The first one should be RL-optimized first. The second should remain mostly SFT
or preference-tuned.

Short-term recommendation:

- keep user-facing answer generation mostly unchanged
- use RL to replace or augment the scoring logic behind `market_signal`
- add a structured action object before natural-language rendering

## Reward Design

### Episode-Level Reward

For trade decision tasks, use a composite reward:

```text
reward =
  realized_return
  - alpha * max_drawdown
  - beta * turnover
  - gamma * volatility
  - delta * slippage_cost
  - eta * rule_violation
```

Recommended first-pass components:

- return over holding window
- downside-only drawdown penalty
- exposure penalty when macro risk is high
- overtrading penalty
- invalid action penalty

### Step-Level Reward / PRM

Reuse the PRM pattern from OpenClaw-RL, but judge market-research steps:

- Did the agent query the right data before acting?
- Did it misuse stale or irrelevant evidence?
- Did it ignore contradictory news or macro data?
- Did it produce an unsupported action?

This PRM should score the latest step using:

- current market state
- selected tools and outputs
- current proposed action
- subsequent market transition or evaluator hint

### Delayed Reward Handling

Financial reward is delayed by nature. Use two layers:

1. dense shaping reward from PRM / rule checks
2. sparse terminal reward from backtest outcome

That is the cleanest mapping from OpenClaw-RL's step judge plus final evaluate
flow into trading tasks.

## Data Pipeline

### Training Sample Types

Create three datasets instead of one:

1. `sft`
   High-quality historical reports and action rationales
2. `rl_prompt`
   Market tasks with symbol/date/objective for rollout
3. `prm`
   Step-level judgment samples for tool usage and reasoning quality

Suggested task schema:

```json
{
  "task_id": "spy_2025-01-15_intraday_breakout",
  "mode": "decision",
  "symbols": ["SPY"],
  "start_ts": "2025-01-15T09:30:00Z",
  "end_ts": "2025-01-15T16:00:00Z",
  "objective": "maximize risk-adjusted return",
  "constraints": {
    "max_position_pct": 0.1,
    "max_turnover": 3
  }
}
```

### Replay Logging

Log every rollout as JSONL:

- prompt/task metadata
- tool schemas available to the agent
- per-turn messages
- tool calls and observations
- structured actions
- final reward breakdown

This gives MarketBot the same replay/debugging benefit that OpenClaw-RL gets
from interaction logs.

## Integration With Existing MarketBot Code

### A. Replace Heuristic `market_signal` Gradually

Current state:

- `marketbot/agent/tools/market.py` computes `market_signal` from fixed weights
- config lives in `marketbot/config/schema.py`

Recommended migration:

1. keep current heuristic path as fallback
2. add `policy_mode = heuristic | rl_hybrid | rl`
3. make `market_signal` call a policy backend
4. if RL policy is unavailable, fall back to the existing heuristic result

This avoids breaking current users while the RL stack matures.

### B. Add A Structured Action Layer

Before rendering the signal card, produce a typed action object:

```json
{
  "action": "buy",
  "position_pct": 0.06,
  "stop_loss_pct": 0.025,
  "take_profit_pct": 0.08,
  "holding_horizon": "swing",
  "confidence": 0.71,
  "evidence_keys": ["snapshot", "news", "macro"]
}
```

The same object can be used by:

- live analysis
- backtest environment
- reward computation
- later broker/execution integrations

### C. Add New CLI Entrypoints

Add RL-specific commands under the existing CLI:

- `marketbot rl collect`
- `marketbot rl backtest-worker`
- `marketbot rl build-dataset`
- `marketbot rl train`
- `marketbot rl evaluate`

This keeps the operator workflow aligned with the rest of the project.

## Phased Delivery Plan

### Phase 0: Instrumentation

Goal: collect structured trajectories without changing behavior.

- add action object generation
- add rollout recorder
- log tool usage and outcomes
- keep heuristic signal logic

Exit criteria:

- can replay a full analysis session from logs
- can export JSONL training data

### Phase 1: Offline Backtest Environment

Goal: create a local market environment compatible with the OpenClaw-RL pattern.

- implement market env lease/reset/exec/evaluate/close
- add historical data adapter
- add rule-based terminal reward

Exit criteria:

- one agent can run on one historical episode end-to-end
- reward breakdown is deterministic and inspectable

### Phase 2: RL-Hybrid Signal Policy

Goal: let RL optimize structured decisions while keeping current UX stable.

- train on offline tasks
- plug policy backend into `market_signal`
- expose fallback and shadow-eval mode

Exit criteria:

- RL policy beats heuristic baseline on offline validation
- no regression in response schema

### Phase 3: PRM And Online Feedback

Goal: improve step quality and analysis efficiency.

- add PRM judge for market tool usage
- learn from thumbs-up/down or explicit correction
- score evidence quality, not only final PnL

Exit criteria:

- PRM correlates with human review
- tool efficiency and action quality both improve

### Phase 4: Distributed Rollout Workers

Goal: scale parallel market episodes.

- add worker pool server
- shard by task/date/universe
- train asynchronously

This is where OpenClaw-RL's remote worker design becomes valuable. Do not start
here.

## Recommended First Implementation Slice

The smallest useful slice is:

1. add `marketbot/rl/recorder.py`
2. add a structured action object behind `market_signal`
3. build an offline backtest environment for one symbol and one strategy horizon
4. compute reward from return, drawdown, and turnover
5. export JSONL rollout data

This gets MarketBot from "static heuristic" to "trainable signal policy" with
the least architectural risk.

## Risks And Mitigations

### Risk 1: Reward Hacking

If reward is only short-horizon return, the agent will overtrade and exploit
noise.

Mitigation:

- include turnover, drawdown, and invalid-action penalties
- evaluate on unseen dates and unseen symbols

### Risk 2: Tool Overuse

If all tools are exposed, the agent may learn wasteful retrieval patterns.

Mitigation:

- use a restricted RL tool subset
- add PRM penalties for irrelevant tool usage

### Risk 3: Mixing Analysis Quality With PnL

A good report can still lose money in a bad regime.

Mitigation:

- separate decision reward from explanation quality reward
- keep response generation mostly outside RL in early phases

### Risk 4: Too-Heavy Training Stack

Directly embedding Slime/Megatron assumptions into MarketBot will make the repo
hard to maintain.

Mitigation:

- keep trainer integration behind `marketbot/rl/trainer/adapter.py`
- treat trainer as external infrastructure

## Bottom-Line Recommendation

The best path is not to port OpenClaw-RL wholesale into MarketBot.

The best path is to copy its control-plane pattern:

- async serving
- env API
- trajectory logging
- PRM judging
- external trainer adapter

Then rebuild the environment and reward model around market/backtest tasks.

If only one thing is implemented first, make it:

"replace heuristic `market_signal` with a structured action layer plus offline
backtestable reward logging."

That creates the foundation for every later RL upgrade without destabilizing the
current MarketBot runtime.
