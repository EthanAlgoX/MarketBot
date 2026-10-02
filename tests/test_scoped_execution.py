"""Tool scopes constrain exposure and execution, including auxiliary flows."""

import asyncio
import json
from copy import deepcopy
from types import SimpleNamespace

import pytest

from marketbot.agent import context_messages, tool_runtime
from marketbot.agent.executor import AgentExecutor
from marketbot.agent.loop import AgentLoop
from marketbot.agent.plan_models import ExecutionPlan, PlanStep, VerifyDecision
from marketbot.agent.subagent import SubagentManager
from marketbot.providers.base import LLMResponse, ToolCallRequest


def make_loop():
    calls = []

    class Registry:
        async def execute(self, name, arguments):
            calls.append((name, arguments))
            return json.dumps({"ok": True, "tool": name})

    loop = SimpleNamespace(
        tools=Registry(),
        _active_allowed_tools=None,
        _normalize_tool_arguments_for_request=lambda name, args: dict(args),
        _tool_policy_result=lambda name: None,
        _compress_tool_result=lambda name, result: result,
        _tool_cache_key=tool_runtime.tool_cache_key,
        _build_cached_tool_result=tool_runtime.build_cached_tool_result,
        _is_parallel_safe_tool=lambda name: name.startswith("market_"),
    )
    return loop, calls


@pytest.mark.parametrize("allowed, executed", [
    (None, ["market_snapshot", "exec"]),
    (set(), []),
    ({"market_snapshot"}, ["market_snapshot"]),
    ({"exec"}, ["exec"]),
])
async def test_scope_guards_actual_sequential_and_parallel_dispatch(allowed, executed):
    loop, calls = make_loop()
    requests = [
        ToolCallRequest(id="snapshot", name="market_snapshot", arguments={"symbols": ["SPY"]}),
        ToolCallRequest(id="exec", name="exec", arguments={"command": "unwanted action"}),
    ]
    with AgentExecutor(loop)._tool_scope(allowed):
        results = await tool_runtime.execute_tool_calls(loop, requests)
    assert [name for name, _ in calls] == executed
    assert [request.id for request, _ in results] == ["snapshot", "exec"]
    for request, output in results:
        if request.name not in executed:
            assert json.loads(output)["error"]["type"] == "tool_scope_violation"
    assert loop._active_allowed_tools is None
    assert tool_runtime.active_tool_scope(loop) is None


async def test_scope_does_not_override_existing_request_policy():
    loop, calls = make_loop()
    loop._tool_policy_result = lambda name: "Error: policy blocked exec"
    request = ToolCallRequest(id="exec", name="exec", arguments={})
    with AgentExecutor(loop)._tool_scope({"exec"}):
        results = await tool_runtime.execute_tool_calls(loop, [request])
    assert results == [(request, "Error: policy blocked exec")]
    assert calls == []


async def test_nested_scopes_restore_on_failure_and_are_loop_specific():
    loop, _ = make_loop()
    other, _ = make_loop()
    original = {"legacy_tool"}
    loop._active_allowed_tools = original
    with AgentExecutor(loop)._tool_scope({"market_snapshot"}):
        assert tool_runtime.active_tool_scope(loop) == {"market_snapshot"}
        assert tool_runtime.active_tool_scope(other) is None
        with AgentExecutor(other)._tool_scope(set()):
            assert tool_runtime.active_tool_scope(other) == set()
            assert tool_runtime.active_tool_scope(loop) == {"market_snapshot"}
        with pytest.raises(RuntimeError):
            with AgentExecutor(loop)._tool_scope(set()):
                assert tool_runtime.active_tool_scope(loop) == set()
                raise RuntimeError("nested failure")
        assert tool_runtime.active_tool_scope(loop) == {"market_snapshot"}
    assert loop._active_allowed_tools is original
    assert tool_runtime.active_tool_scope(loop) is original


async def test_parallel_sessions_keep_independent_scopes_on_shared_loop():
    loop, calls = make_loop()
    entered = 0
    both_entered = asyncio.Event()

    async def run(name, denied):
        nonlocal entered
        with AgentExecutor(loop)._tool_scope({name}):
            entered += 1
            if entered == 2:
                both_entered.set()
            await both_entered.wait()
            await asyncio.sleep(0)
            return await tool_runtime.execute_tool_calls(loop, [
                ToolCallRequest(id=name, name=name, arguments={}),
                ToolCallRequest(id=denied, name=denied, arguments={}),
            ])

    outputs = await asyncio.gather(run("market_a", "market_b"), run("market_b", "market_a"))
    assert sorted(name for name, _ in calls) == ["market_a", "market_b"]
    for results in outputs:
        assert json.loads(results[1][1])["error"]["type"] == "tool_scope_violation"
    assert loop._active_allowed_tools is None
    assert tool_runtime.active_tool_scope(loop) is None


def test_scope_limits_model_visibility_including_deny_all():
    loop = AgentLoop.__new__(AgentLoop)
    loop.context = SimpleNamespace(available_tools={"market_snapshot", "exec"})
    with AgentExecutor(loop)._tool_scope(set()):
        assert loop._visible_tool_names() == set()
    with AgentExecutor(loop)._tool_scope({"market_snapshot"}):
        assert loop._visible_tool_names() == {"market_snapshot"}
    assert loop._visible_tool_names() == {"market_snapshot", "exec"}


@pytest.mark.parametrize("helper, resolver, tool_name", [
    ("_direct_xiaohongshu_publish", "_direct_xiaohongshu_publish_fallback", "xiaohongshu_cli"),
    ("_direct_xiaohongshu_research", "_direct_xiaohongshu_research_fallback", "xiaohongshu_cli"),
    ("_direct_twitter_publish", "_direct_twitter_publish_fallback", "twitter_cli"),
])
async def test_direct_shortcuts_cannot_bypass_scope(monkeypatch, helper, resolver, tool_name):
    loop, calls = make_loop()
    monkeypatch.setattr(tool_runtime, resolver, lambda messages: "explicit action request")
    with AgentExecutor(loop)._tool_scope(set()):
        assert await getattr(tool_runtime, helper)(loop, []) is None
        blocked = await tool_runtime._execute_scoped_tool(loop, tool_name, {})
        assert json.loads(blocked)["error"]["type"] == "tool_scope_violation"
    assert calls == []


async def test_automatic_news_fallback_cannot_bypass_scope():
    loop, calls = make_loop()
    loop._active_request_flags = {"twitter_research": True}
    request = ToolCallRequest(id="twitter", name="twitter_cli", arguments={"query": "$NVDA"})
    with AgentExecutor(loop)._tool_scope({"twitter_cli"}):
        result = await tool_runtime._maybe_run_twitter_news_fallback(loop, request, "", [], [], 1)
    assert result is None
    assert calls == []


async def test_hallucinated_tool_call_is_blocked_even_when_provider_ignores_empty_definitions():
    loop, calls = make_loop()
    seen_tools = []
    auto_calls = []

    class Provider:
        async def chat(self, **kwargs):
            seen_tools.append(kwargs["tools"])
            if len(seen_tools) == 1:
                return LLMResponse(content="", tool_calls=[ToolCallRequest(id="exec", name="exec", arguments={})])
            return LLMResponse(content="final synthesis")

    async def auto_brief(messages, tools_used, *, tool_rounds):
        auto_calls.append(True)
        return messages, tools_used, tool_rounds

    loop.provider = Provider()
    loop.max_iterations = 2
    loop.model = "test"
    loop.temperature = 0
    loop.max_tokens = 100
    loop.reasoning_effort = None
    loop.context = SimpleNamespace(
        add_assistant_message=context_messages.add_assistant_message,
        add_tool_result=context_messages.add_tool_result,
    )
    loop._is_broad_market_scan_request = lambda messages: False
    loop._selected_skill_names = lambda: []
    loop._DAILY_OPPORTUNITY_SKILL = "daily-market-opportunity"
    for method in ("_is_xiaohongshu_request", "_is_twitter_request", "_is_lark_request"):
        setattr(loop, method, lambda messages: False)
    # A legacy registry/policy may expose all tools; the runner still filters it.
    loop._tool_definitions_for_request = lambda: [{"type": "function", "function": {"name": "exec"}}]
    loop._merge_usage = tool_runtime.merge_usage
    loop._strip_think = lambda content: content
    loop._execute_tool_calls = lambda requests: tool_runtime.execute_tool_calls(loop, requests)
    loop._auto_append_daily_opportunity_market_brief = auto_brief
    with AgentExecutor(loop)._tool_scope(set()):
        final, _, messages, _ = await tool_runtime.run_agent_loop(loop, [{"role": "user", "content": "summarize"}])
    assert final == "final synthesis"
    assert seen_tools == [[], []]
    assert calls == []
    assert auto_calls == []
    tool_result = next(message for message in messages if message["role"] == "tool")
    assert json.loads(tool_result["content"])["error"]["type"] == "tool_scope_violation"


@pytest.mark.parametrize("tool_name", ["portfolio_risk", "mcp_finance_portfolio_risk"])
def test_portfolio_compression_preserves_calculations_and_position_evidence(tool_name):
    payload = json.dumps({
        "totalValue": 60000, "baseCurrency": "USD",
        "holdings": [{"symbol": f"STOCK-{index}", "value": 600, "weight": 0.01} for index in range(100)],
        "concentration": {"top5Weight": 0.05}, "warnings": ["scenario is an assumption"],
    })
    assert len(payload) > AgentLoop._TOOL_RESULT_PROMPT_MAX_CHARS
    assert AgentLoop._compress_tool_result(tool_name, payload) == payload
    assert AgentLoop._is_parallel_safe_tool(tool_name) is True


@pytest.mark.parametrize("tool_name", [
    "market_snapshot", "mcp_finance_market_snapshot", "market_fundamentals",
    "mcp_finance_market_fundamentals", "market_news", "mcp_finance_market_news",
    "market_macro", "mcp_finance_market_macro", "market_signal", "mcp_finance_market_signal",
])
def test_finance_compression_preserves_quotes_and_source_references(tool_name):
    payload = json.dumps({
        "asOf": "2026-10-02T00:00:00Z", "symbols": ["SPY"],
        "quotes": [{"symbol": "SPY", "price": 123.45, "currency": "USD"}],
        "items": [{"headline": f"source-{index}", "url": f"https://source.example/{index}"} for index in range(30)],
        "sourceHealth": {"unit": {"status": "ok"}}, "warnings": [],
    })
    assert len(payload) > AgentLoop._TOOL_RESULT_PROMPT_MAX_CHARS
    compressed = AgentLoop._compress_tool_result(tool_name, payload)
    assert compressed == payload
    evidence = json.loads(compressed)
    assert evidence["quotes"][0]["price"] == 123.45
    assert evidence["items"][0]["url"] == "https://source.example/0"


def test_generic_tool_compression_still_bounds_unrelated_large_outputs():
    payload = json.dumps({"items": [{"text": "large output" * 40} for _ in range(20)]})
    compressed = AgentLoop._compress_tool_result("web_search", payload)
    assert json.loads(compressed)["_truncated"] is True
    assert len(compressed) < len(payload)


def make_subagent(provider):
    manager = SubagentManager.__new__(SubagentManager)
    manager.provider = provider
    manager.model = "test"
    manager.temperature = 0
    manager.max_tokens = 100
    manager.reasoning_effort = None
    return manager


@pytest.mark.parametrize("exposed", [set(), {"read_file"}])
async def test_subagent_blocks_hallucinated_tools_outside_exposed_names(exposed):
    loop, calls = make_loop()
    loop.tools.get_definitions = lambda *, exposed_names: [
        {"type": "function", "function": {"name": name}} for name in sorted(exposed_names)
    ]
    prompts = []

    class Provider:
        async def chat(self, **kwargs):
            prompts.append(kwargs["tools"])
            if len(prompts) == 1:
                return LLMResponse(content="", tool_calls=[
                    ToolCallRequest(id="read", name="read_file", arguments={}),
                    ToolCallRequest(id="exec", name="exec", arguments={}),
                ])
            return LLMResponse(content="finished")

    manager = make_subagent(Provider())
    result, _, messages = await manager._run_local_react_loop(
        messages=[{"role": "user", "content": "summarize"}], tools=loop.tools,
        exposed_names=exposed,
    )
    assert result == "finished"
    assert [name for name, _ in calls] == (["read_file"] if exposed else [])
    for message in messages:
        if message["role"] == "tool" and message["name"] not in exposed:
            assert json.loads(message["content"])["error"]["type"] == "tool_scope_violation"
    assert [message["tool_call_id"] for message in messages if message["role"] == "tool"] == ["read", "exec"]


@pytest.mark.parametrize("data_available", [True, False])
async def test_subagent_plan_passes_goal_and_evidence_to_tool_free_final_step(data_available):
    evidence = {"source": "local", "value": 123} if data_available else {"error": {"message": "source unavailable"}}
    tools = SimpleNamespace(
        get_definitions=lambda *, exposed_names: [{"type": "function", "function": {"name": name}} for name in exposed_names]
    )
    prompts = []
    calls = []
    decisions = []

    async def execute(name, arguments):
        calls.append(name)
        return json.dumps(evidence)

    tools.execute = execute

    class Provider:
        async def chat(self, **kwargs):
            prompts.append(deepcopy(kwargs))
            if len(prompts) == 1:
                assert "Research SPY with local sources" in kwargs["messages"][-1]["content"]
                return LLMResponse(content="", tool_calls=[ToolCallRequest(id="source-1", name="read_file", arguments={})])
            if len(prompts) == 2:
                return LLMResponse(content="collection summary")
            assert kwargs["tools"] == []
            result = next(message for message in kwargs["messages"] if message["role"] == "tool")
            assert result["tool_call_id"] == "source-1"
            assert json.loads(result["content"]) == evidence
            assert sum(message["role"] == "system" for message in kwargs["messages"]) == 1
            return LLMResponse(content="final answer with evidence or explicit data gaps")

    manager = make_subagent(Provider())
    plan = ExecutionPlan(id="sub-plan", goal="Research SPY with local sources", steps=[
        PlanStep(id="collect", title="Collect", instruction="read evidence", allowed_tools=["read_file"]),
        PlanStep(id="answer", title="Answer", instruction="use collected evidence"),
    ])
    manager.planner = SimpleNamespace(create_plan=lambda **kwargs: plan)

    def verify(*, step, step_result):
        decisions.append(step_result.status)
        # A domain verifier can accept an unavailable source to report a data gap.
        return VerifyDecision(outcome="advance", reason="data_or_explicit_gap")

    manager.verifier = SimpleNamespace(evaluate=verify)
    result = await manager._run_planned_subagent_task(
        task=plan.goal, tools=tools, healthy_names={"read_file"}, system_prompt="system",
    )
    assert result == "final answer with evidence or explicit data gaps"
    assert calls == ["read_file"]
    assert decisions == (["completed", "completed"] if data_available else ["failed", "completed"])
    assert [step.status for step in plan.steps] == ["completed", "completed"]


async def test_whole_turn_context_cannot_cross_chat_boundaries(tmp_path):
    from marketbot.bus.events import InboundMessage, OutboundMessage
    from marketbot.bus.queue import MessageBus
    from marketbot.providers.base import LLMProvider

    class Provider(LLMProvider):
        async def chat(self, **kwargs):
            return LLMResponse(content='unused')

        def get_default_model(self):
            return 'test'

    loop = AgentLoop(bus=MessageBus(), provider=Provider(), workspace=tmp_path, model='test')
    entered = asyncio.Event()
    release = asyncio.Event()
    seen = []

    async def turn(msg, *_args):
        loop._active_request_flags = {'owner': msg.chat_id}
        if msg.chat_id == 'first':
            entered.set()
            await release.wait()
        seen.append(loop._active_request_flags['owner'])
        return OutboundMessage(channel=msg.channel, chat_id=msg.chat_id, content='ok')

    loop._process_message_unlocked = turn
    first = asyncio.create_task(loop._process_message(InboundMessage(channel='test',sender_id='user',chat_id='first',content='hello')))
    await entered.wait()
    second = asyncio.create_task(loop._process_message(InboundMessage(channel='test',sender_id='user',chat_id='second',content='hello')))
    await asyncio.sleep(0)
    assert not second.done()
    release.set()
    await asyncio.gather(first, second)
    assert seen == ['first', 'second']
