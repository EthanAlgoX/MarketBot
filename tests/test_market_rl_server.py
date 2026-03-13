import asyncio
import json
from dataclasses import dataclass, field
from enum import Enum

from marketbot.rl.env.server import MarketEnvHttpServer
from marketbot.rl.metrics_server import MetricsHttpServer
from marketbot.rl.slime_generate import generate


@dataclass
class _FakeSample:
    class Status(Enum):
        PENDING = "pending"
        COMPLETED = "completed"

    prompt: object
    response: str = ""
    response_length: int = 0
    reward: object = None
    metadata: dict = field(default_factory=dict)
    status: Status = Status.PENDING


class _EnvBackedRemoteClient:
    def __init__(self, server: MarketEnvHttpServer) -> None:
        self._env = server.env

    async def allocate(self, task_key: str, request_id: str | None = None) -> dict[str, object]:
        self._env.register_task(task_key, {"symbol": task_key, "prices": [1.0, 1.0]})
        return await self._env.allocate(task_key, request_id=request_id)

    async def heartbeat(self, lease_id: str) -> dict[str, object]:
        return await self._env.heartbeat(lease_id)

    async def reset(
        self,
        lease_id: str,
        task_meta: dict[str, object],
        run_ctx: dict[str, object],
        task_timeouts: dict[str, object] | None = None,
    ) -> dict[str, object]:
        return await self._env.reset(lease_id, task_meta=task_meta, run_ctx=run_ctx, task_timeouts=task_timeouts)

    async def exec_tool(self, lease_id: str, tool_name: str, arguments: dict[str, object]) -> str:
        return await self._env.exec_tool(lease_id, tool_name, arguments)

    async def evaluate(self, lease_id: str) -> float:
        return await self._env.evaluate(lease_id)

    async def evaluate_details(self, lease_id: str) -> dict[str, object]:
        return self._env.evaluate_details(lease_id)

    async def close(self, lease_id: str) -> dict[str, object]:
        await self._env.close(lease_id)
        return {"ok": True}


def test_market_env_http_server_routes_support_roundtrip() -> None:
    server = MarketEnvHttpServer(host="127.0.0.1", port=0, allow_dynamic_tasks=True, bind=False)
    assert server.env.status()["ok"] is True
    lease = server._handle_request("/allocate", {"task_key": "market_signal::NVDA", "request_id": "req-1"})
    lease_id = str(lease["lease_id"])
    reset = server._handle_request(
        "/reset",
        {
            "lease_id": lease_id,
            "task_meta": {
                "symbol": "NVDA",
                "prices": [100.0, 105.0, 110.0],
                "instruction": "Trade NVDA remotely.",
            },
            "run_ctx": {"uid": "remote-test"},
        },
    )
    assert reset["task"]["symbol"] == "NVDA"
    heartbeat = server._handle_request("/heartbeat", {"lease_id": lease_id})
    assert heartbeat["ok"] is True
    submit = json.loads(
        server._handle_request(
            "/exec_tool",
            {
                "lease_id": lease_id,
                "tool_call": {"name": "submit_trade_action", "arguments": {"action": "buy", "position_pct": 0.5}},
            },
        )["observation"]
    )
    assert submit["applied"]["positionPct"] == 0.5
    advance = json.loads(
        server._handle_request(
            "/exec_tool",
            {
                "lease_id": lease_id,
                "tool_call": {"name": "advance_time", "arguments": {"steps": 2}},
            },
        )["observation"]
    )
    assert advance["done"] is True
    score = server._handle_request("/evaluate", {"lease_id": lease_id})["score"]
    details = server._handle_request("/evaluate_details", {"lease_id": lease_id})["evaluation"]
    assert score == details["reward"]["score"]
    assert details["equity"] > 1.0
    assert server._handle_request("/close", {"lease_id": lease_id})["ok"] is True


def test_slime_generate_can_use_remote_market_env_server(monkeypatch) -> None:
    server = MarketEnvHttpServer(host="127.0.0.1", port=0, allow_dynamic_tasks=True, bind=False)
    sample = _FakeSample(
        prompt={
            "task": {
                "task_name": "market_signal::NVDA",
                "instruction": "Analyze NVDA and trade the remote rollout.",
                "symbol": "NVDA",
                "prices": [100.0, 103.0, 108.0],
                "features": {
                    "price_change_pct": 3.0,
                    "news_sentiment": 0.7,
                    "social_sentiment": 0.4,
                    "macro_risk": 0.2,
                },
            }
        }
    )
    monkeypatch.setattr("marketbot.rl.slime_generate.RemoteMarketEnvClient", lambda base_url: _EnvBackedRemoteClient(server))

    monkeypatch.setenv("ENV_SERVER_URL", "http://in-process.invalid")
    result = asyncio.run(generate(args=None, sample=sample, sampling_params={}))
    monkeypatch.delenv("ENV_SERVER_URL", raising=False)

    assert result is sample
    assert sample.status == _FakeSample.Status.COMPLETED
    assert sample.reward["score"] > 0
    assert sample.metadata["marketbot_eval"]["symbol"] == "NVDA"
    response = json.loads(sample.response)
    assert response["structuredAction"]["action"] == "buy"


def test_metrics_http_server_serves_metrics_summary_and_alerts() -> None:
    def _metrics_payload() -> dict[str, object]:
        return {
            "ok": False,
            "date": "20260313",
            "generatedAt": "2026-03-13T12:00:00Z",
            "compareField": "score",
            "summaryMarkdown": "/tmp/summary.md",
            "summaryCsv": "/tmp/summary.csv",
            "totalCount": 4,
            "filteredCount": 4,
            "successCount": 2,
            "successRate": 0.5,
            "compareSummary": {
                "field": "score",
                "count": 4,
                "avg": 0.41,
                "min": 0.1,
                "max": 0.7,
                "best": {"value": 0.7},
                "worst": {"value": 0.55},
            },
            "thresholdChecks": {
                "minSuccessRate": {"enabled": True, "threshold": 0.7, "actual": 0.5, "passed": False},
                "maxWorst": {"enabled": True, "threshold": 0.3, "actual": 0.55, "passed": False},
            },
        }

    def _render_metrics(payload: dict[str, object]) -> str:
        return f"marketbot_openclaw_threshold_ok {1 if payload['ok'] else 0}\n"

    def _build_alerts(payload: dict[str, object]) -> dict[str, object]:
        return {
            "ok": payload["ok"],
            "activeAlertCount": 2,
            "failedChecks": [
                {"name": "minSuccessRate", "severity": "critical"},
                {"name": "maxWorst", "severity": "critical"},
            ],
            "alerts": [
                {
                    "status": "firing",
                    "labels": {"alertname": "MarketBotOpenClawminSuccessRate", "severity": "critical"},
                    "annotations": {"summary": "minSuccessRate threshold failed"},
                }
            ],
            "date": payload["date"],
            "compareField": payload["compareField"],
            "summaryMarkdown": payload["summaryMarkdown"],
            "summaryCsv": payload["summaryCsv"],
        }

    def _render_alertmanager(alerts_payload: dict[str, object]) -> dict[str, object]:
        return {
            "receiver": "marketbot-openclaw",
            "status": "firing",
            "alerts": alerts_payload["alerts"],
            "commonLabels": {"compare_field": alerts_payload["compareField"]},
        }

    server = MetricsHttpServer(
        host="127.0.0.1",
        port=0,
        metrics_payload_factory=_metrics_payload,
        metrics_renderer=_render_metrics,
        alerts_builder=_build_alerts,
        alertmanager_renderer=_render_alertmanager,
        bind=False,
    )
    health = server.handle_request("/healthz")
    assert health["status"] == 200
    assert json.loads(health["body"])["ok"] is True

    summary = server.handle_request("/summary.json")
    assert summary["status"] == 503
    assert json.loads(summary["body"])["ok"] is False

    metrics = server.handle_request("/metrics")
    assert metrics["status"] == 503
    assert "marketbot_openclaw_threshold_ok 0" in metrics["body"].decode("utf-8")

    alerts = server.handle_request("/alerts")
    assert alerts["status"] == 503
    alerts_payload = json.loads(alerts["body"])
    assert alerts_payload["activeAlertCount"] == 2
    assert alerts_payload["failedChecks"][0]["severity"] == "critical"

    alertmanager = server.handle_request("/alerts/prometheus")
    assert alertmanager["status"] == 503
    alertmanager_payload = json.loads(alertmanager["body"])
    assert alertmanager_payload["receiver"] == "marketbot-openclaw"
    assert alertmanager_payload["alerts"][0]["labels"]["alertname"] == "MarketBotOpenClawminSuccessRate"
