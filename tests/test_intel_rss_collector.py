"""Exercise actual feed bytes and the collector's async HTTP/parser boundaries."""

import asyncio
import json
import threading

import httpx
import pytest

from marketbot.domain.intel.collector import RssCollector
from marketbot.domain.intel.models import IntelSource


def source(url="https://example.com/feeds/latest.xml"):
    return IntelSource(id=1, name="fixture", source_type="rss", config_json=json.dumps({"url": url}))


def mock_fetch(monkeypatch, handler):
    client_class = httpx.AsyncClient
    clients = []

    def client(**kwargs):
        clients.append(kwargs)
        return client_class(**kwargs, transport=httpx.MockTransport(handler))

    monkeypatch.setattr("marketbot.domain.intel.collector.httpx.AsyncClient", client)
    return clients


def test_actual_rss_bytes_follow_redirects_resolve_links_and_preserve_time(monkeypatch):
    requests = []
    rss = b'''<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0"><channel><title>Fixture feed</title>
      <item><title>Market update</title><link>../story</link><description>Observed news</description>
      <pubDate>Tue, 17 Mar 2026 18:00:00 +0800</pubDate></item></channel></rss>'''

    def handler(request):
        requests.append(request)
        if request.url.path.endswith("latest.xml"):
            return httpx.Response(302, headers={"location": "/archive/feed.xml"})
        return httpx.Response(200, content=rss, headers={"content-type": "application/rss+xml; charset=utf-8"})

    clients = mock_fetch(monkeypatch, handler)
    items = asyncio.run(RssCollector().collect(source()))
    assert len(requests) == 2
    assert requests[0].headers["user-agent"] == "MarketBot/1.0"
    assert clients[0]["timeout"] == 20.0 and clients[0]["follow_redirects"] is True
    assert items[0].url == "https://example.com/story"
    assert items[0].published_at == "2026-03-17T10:00:00Z"
    assert json.loads(items[0].metadata_json)["sourcePublishedAt"] == "Tue, 17 Mar 2026 18:00:00 +0800"
    assert items[0].collected_at != items[0].published_at


@pytest.mark.parametrize("updated,expected", [
    ("2026-03-17T18:00:00+08:00", "2026-03-17T10:00:00Z"),
    ("2026-03-17T10:00:00Z", "2026-03-17T10:00:00Z"),
    ("2026-03-17T10:00:00", None),
    ("not a date", None),
])
def test_atom_updates_do_not_invent_publication_timezone(monkeypatch, updated, expected):
    atom = f'''<feed xmlns="http://www.w3.org/2005/Atom"><title>Fixture</title>
    <entry><id>urn:fixture:1</id><title>Update</title><link href="/story"/>
    <updated>{updated}</updated><summary>Actual source text</summary></entry></feed>'''.encode()
    mock_fetch(monkeypatch, lambda request: httpx.Response(200, content=atom, headers={"content-type": "application/atom+xml"}))
    item = asyncio.run(RssCollector().collect(source()))[0]
    assert item.published_at == expected
    assert json.loads(item.metadata_json)["sourcePublishedAt"] == updated
    assert item.url == "https://example.com/story"


@pytest.mark.parametrize("failure", ["status", "timeout"])
def test_rss_http_failure_is_explicit_without_credential_url(monkeypatch, failure):
    def handler(request):
        if failure == "timeout":
            raise httpx.ReadTimeout("provider timeout on secret=abc", request=request)
        return httpx.Response(503)

    mock_fetch(monkeypatch, handler)
    with pytest.raises(ValueError, match="rss fetch failed") as exc:
        asyncio.run(RssCollector().collect(source("https://example.com/feed?api_key=secret-token")))
    assert "example.com" not in str(exc.value)
    assert "secret" not in str(exc.value)
    assert ("ReadTimeout" if failure == "timeout" else "HTTPStatusError") in str(exc.value)


def test_invalid_feed_failure_is_explicit_without_echoing_response(monkeypatch):
    mock_fetch(monkeypatch, lambda request: httpx.Response(200, content=b"<secret_token='fixture'>"))
    with pytest.raises(ValueError, match="feed parse failed") as exc:
        asyncio.run(RssCollector().collect(source()))
    assert "secret_token" not in str(exc.value)


def test_feed_parser_runs_off_event_loop(monkeypatch):
    mock_fetch(monkeypatch, lambda request: httpx.Response(200, content=b"fixture"))
    release_parser = threading.Event()
    parser_completed_with_loop_progress = []

    async def scenario():
        loop = asyncio.get_running_loop()
        started = asyncio.Event()

        def parser(data, **kwargs):
            loop.call_soon_threadsafe(started.set)
            parser_completed_with_loop_progress.append(release_parser.wait(timeout=2))
            return type("Parsed", (), {"bozo": 0, "entries": []})()

        monkeypatch.setattr("marketbot.domain.intel.collector.feedparser.parse", parser)
        collecting = asyncio.create_task(RssCollector().collect(source()))
        await asyncio.wait_for(started.wait(), timeout=3)
        release_parser.set()
        assert await collecting == []

    asyncio.run(scenario())
    assert parser_completed_with_loop_progress == [True]
