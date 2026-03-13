"""HTTP server for exposing latest OpenClaw metrics and alerts."""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable


class MetricsHttpServer:
    """Small HTTP server exposing metrics, summaries, and alert payloads."""

    def __init__(
        self,
        *,
        host: str,
        port: int,
        metrics_payload_factory: Callable[[], dict[str, Any]],
        metrics_renderer: Callable[[dict[str, Any]], str],
        alerts_builder: Callable[[dict[str, Any]], dict[str, Any]],
        alertmanager_renderer: Callable[[dict[str, Any]], dict[str, Any]],
        bind: bool = True,
    ) -> None:
        self._metrics_payload_factory = metrics_payload_factory
        self._metrics_renderer = metrics_renderer
        self._alerts_builder = alerts_builder
        self._alertmanager_renderer = alertmanager_renderer
        self._server = ThreadingHTTPServer((host, port), self._make_handler()) if bind else None
        if self._server is not None:
            bound_host, bound_port = self._server.server_address
            self.host = str(bound_host)
            self.port = int(bound_port)
        else:
            self.host = str(host)
            self.port = int(port)
        self.base_url = f"http://{self.host}:{self.port}"

    def _make_handler(self):
        parent = self

        class _Handler(BaseHTTPRequestHandler):
            def do_GET(self):  # noqa: N802
                status, content_type, body = parent._build_response(self.path)
                self.send_response(status)
                if content_type:
                    self.send_header("Content-Type", content_type)
                    self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                if body:
                    self.wfile.write(body)

            def _write_json(self, status: int, payload: dict[str, Any]) -> None:
                body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
                self.send_response(status)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, format: str, *args):  # noqa: A003
                return

        return _Handler

    def _build_response(self, path: str) -> tuple[int, str | None, bytes]:
        payload = self._metrics_payload_factory()
        alerts_payload = self._alerts_builder(payload)
        if path == "/healthz":
            body = json.dumps({"ok": True}, ensure_ascii=False).encode("utf-8")
            return 200, "application/json; charset=utf-8", body
        if path == "/summary.json":
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            return 200 if payload.get("ok") else 503, "application/json; charset=utf-8", body
        if path == "/alerts":
            body = json.dumps(alerts_payload, ensure_ascii=False).encode("utf-8")
            return 200 if alerts_payload.get("ok") else 503, "application/json; charset=utf-8", body
        if path == "/alerts/prometheus":
            body = json.dumps(self._alertmanager_renderer(alerts_payload), ensure_ascii=False).encode("utf-8")
            return 200 if alerts_payload.get("ok") else 503, "application/json; charset=utf-8", body
        if path == "/metrics":
            body = self._metrics_renderer(payload).encode("utf-8")
            return 200 if payload.get("ok") else 503, "text/plain; version=0.0.4; charset=utf-8", body
        return 404, None, b""

    def handle_request(self, path: str) -> dict[str, Any]:
        status, content_type, body = self._build_response(path)
        return {"status": status, "content_type": content_type, "body": body}

    def serve_forever(self) -> None:
        if self._server is None:
            raise RuntimeError("server is not bound")
        self._server.serve_forever()

    def shutdown(self) -> None:
        if self._server is not None:
            self._server.shutdown()

    def server_close(self) -> None:
        if self._server is not None:
            self._server.server_close()
