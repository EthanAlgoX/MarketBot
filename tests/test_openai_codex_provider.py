"""OAuth bearer requests must never retry with TLS verification disabled."""

import asyncio
from types import SimpleNamespace

import httpx

import marketbot.providers.openai_codex_provider as codex


def test_certificate_failure_does_not_resend_oauth_token_or_echo_error(monkeypatch):
    monkeypatch.setattr(codex, "get_codex_token", lambda: SimpleNamespace(account_id="account", access="never-print-this"))
    calls = []

    async def failed_request(url, headers, body):
        calls.append((url, headers, body))
        raise httpx.ConnectError("[SSL: CERTIFICATE_VERIFY_FAILED] authorization=never-print-this")

    monkeypatch.setattr(codex, "_request_codex", failed_request)
    response = asyncio.run(codex.OpenAICodexProvider().chat([{"role": "user", "content": "hi"}]))

    assert len(calls) == 1
    assert calls[0][1]["Authorization"] == "Bearer never-print-this"
    assert response.finish_reason == "error"
    assert "trusted CA" in response.content
    assert "never-print-this" not in response.content


def test_codex_request_always_uses_verified_tls(monkeypatch):
    captured = {}

    class Context:
        async def __aenter__(self):
            return SimpleNamespace(status_code=200)

        async def __aexit__(self, *args):
            pass

    class Client:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        def stream(self, *args, **kwargs):
            captured["headers"] = kwargs["headers"]
            return Context()

    async def consume(response):
        return "answer", [], "stop"

    monkeypatch.setattr(codex.httpx, "AsyncClient", Client)
    monkeypatch.setattr(codex, "_consume_sse", consume)
    result = asyncio.run(codex._request_codex("https://example.org/responses", {"Authorization": "Bearer token"}, {}))
    assert captured["verify"] is True
    assert result == ("answer", [], "stop")
