"""HTTP server exposing a LocalMarketEnv with OpenClaw-compatible routes."""

from __future__ import annotations

import asyncio
import json
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from marketbot.rl.env.market_env import LocalMarketEnv


def _placeholder_task(task_key: str) -> dict[str, Any]:
    return {
        "symbol": str(task_key).upper(),
        "prices": [1.0, 1.0],
        "instruction": f"Reset {task_key} with concrete task metadata before use.",
    }


class MarketEnvHttpServer:
    """Thin HTTP wrapper around LocalMarketEnv for remote rollouts."""

    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 18080,
        *,
        task_catalog: dict[str, dict[str, Any]] | None = None,
        allow_dynamic_tasks: bool = True,
        bind: bool = True,
    ) -> None:
        self.env = LocalMarketEnv(task_catalog=task_catalog)
        self.allow_dynamic_tasks = bool(allow_dynamic_tasks)
        self._httpd = ThreadingHTTPServer(
            (host, int(port)),
            self._make_handler(),
            bind_and_activate=bind,
        )

    @property
    def host(self) -> str:
        return str(self._httpd.server_address[0])

    @property
    def port(self) -> int:
        return int(self._httpd.server_address[1])

    @property
    def base_url(self) -> str:
        return f"http://{self.host}:{self.port}"

    def _make_handler(self):
        server = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, format: str, *args: Any) -> None:
                return

            def do_GET(self) -> None:
                if self.path == "/healthz":
                    self._write_json(HTTPStatus.OK, {"ok": True, "status": "healthy"})
                    return
                if self.path == "/status":
                    self._write_json(HTTPStatus.OK, server.env.status())
                    return
                self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "not found"})

            def do_POST(self) -> None:
                try:
                    payload = self._read_json()
                    response = server._handle_request(self.path, payload)
                    self._write_json(HTTPStatus.OK, response)
                except KeyError as exc:
                    self._write_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": str(exc)})
                except ValueError as exc:
                    self._write_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": str(exc)})
                except RuntimeError as exc:
                    self._write_json(HTTPStatus.CONFLICT, {"ok": False, "error": str(exc)})
                except Exception as exc:  # pragma: no cover
                    self._write_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": str(exc)})

            def _read_json(self) -> dict[str, Any]:
                raw_length = self.headers.get("Content-Length", "0")
                length = int(raw_length or 0)
                body = self.rfile.read(length) if length > 0 else b"{}"
                parsed = json.loads(body.decode("utf-8") or "{}")
                if not isinstance(parsed, dict):
                    raise ValueError("request body must be a JSON object")
                return parsed

            def _write_json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
                encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                self.send_response(int(status))
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(encoded)))
                self.end_headers()
                self.wfile.write(encoded)

        return Handler

    def _ensure_task_key(self, task_key: str) -> None:
        if task_key in self.env.status()["taskKeys"]:
            return
        if not self.allow_dynamic_tasks:
            raise KeyError(f"unknown task_key: {task_key}")
        self.env.register_task(task_key, _placeholder_task(task_key))

    def _handle_request(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        if path == "/allocate":
            task_key = str(payload.get("task_key") or "").strip()
            if not task_key:
                raise ValueError("task_key is required")
            self._ensure_task_key(task_key)
            return asyncio.run(
                self.env.allocate(task_key=task_key, request_id=payload.get("request_id"))
            )
        if path == "/heartbeat":
            lease_id = str(payload.get("lease_id") or "").strip()
            if not lease_id:
                raise ValueError("lease_id is required")
            return asyncio.run(self.env.heartbeat(lease_id))
        if path == "/reset":
            lease_id = str(payload.get("lease_id") or "").strip()
            if not lease_id:
                raise ValueError("lease_id is required")
            return asyncio.run(
                self.env.reset(
                    lease_id=lease_id,
                    task_meta=dict(payload.get("task_meta") or {}),
                    run_ctx=dict(payload.get("run_ctx") or {}),
                    task_timeouts=payload.get("task_timeouts"),
                )
            )
        if path == "/exec_tool":
            lease_id = str(payload.get("lease_id") or "").strip()
            tool_call = dict(payload.get("tool_call") or {})
            tool_name = str(tool_call.get("name") or "").strip()
            if not lease_id or not tool_name:
                raise ValueError("lease_id and tool_call.name are required")
            observation = asyncio.run(
                self.env.exec_tool(
                    lease_id=lease_id,
                    tool_name=tool_name,
                    arguments=dict(tool_call.get("arguments") or {}),
                )
            )
            return {"ok": True, "observation": observation}
        if path == "/evaluate":
            lease_id = str(payload.get("lease_id") or "").strip()
            if not lease_id:
                raise ValueError("lease_id is required")
            score = asyncio.run(self.env.evaluate(lease_id))
            return {"ok": True, "score": score}
        if path == "/evaluate_details":
            lease_id = str(payload.get("lease_id") or "").strip()
            if not lease_id:
                raise ValueError("lease_id is required")
            return {"ok": True, "evaluation": self.env.evaluate_details(lease_id)}
        if path == "/close":
            lease_id = str(payload.get("lease_id") or "").strip()
            if not lease_id:
                raise ValueError("lease_id is required")
            asyncio.run(self.env.close(lease_id))
            return {"ok": True}
        raise KeyError(f"unsupported route: {path}")

    def serve_forever(self) -> None:
        self._httpd.serve_forever()

    def shutdown(self) -> None:
        self._httpd.shutdown()
        self._httpd.server_close()

    def start_in_thread(self, name: str = "marketbot-env-server") -> threading.Thread:
        thread = threading.Thread(target=self.serve_forever, name=name, daemon=True)
        thread.start()
        return thread


def load_task_catalog(path: str | Path | None) -> dict[str, dict[str, Any]]:
    """Load a JSON task catalog from disk."""
    if path is None:
        return {}
    source = Path(path)
    if not source.exists():
        raise FileNotFoundError(source)
    parsed = json.loads(source.read_text(encoding="utf-8"))
    if not isinstance(parsed, dict):
        raise ValueError("task catalog must be a JSON object")
    return {str(key): dict(value or {}) for key, value in parsed.items()}
