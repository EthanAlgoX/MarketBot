import json
import asyncio
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import AsyncMock, patch

from typer.testing import CliRunner

from marketbot.cli.commands import app
from marketbot.config.schema import Config
from marketbot.domain.intel.collector import RssCollector, make_dedup_key
from marketbot.domain.intel.digest import build_daily_digest
from marketbot.domain.intel.models import IntelRawItem, IntelSource
from marketbot.domain.intel.search import IntelSearchService
from marketbot.domain.intel.storage import (
    add_source,
    connect_intel_db,
    init_intel_schema,
    insert_raw_items,
    list_digests,
    list_recent_raw_items,
    list_sources,
)

runner = CliRunner()


def _make_conn(tmp_path: Path):
    workspace = tmp_path / "workspace"
    workspace.mkdir(parents=True, exist_ok=True)
    conn = connect_intel_db(workspace)
    init_intel_schema(conn)
    return workspace, conn


def test_intel_storage_roundtrip_and_digest_build(tmp_path) -> None:
    workspace, conn = _make_conn(tmp_path)
    try:
        source_id = add_source(
            conn,
            IntelSource(
                name="OpenAI Blog",
                source_type="rss",
                config_json=json.dumps({"url": "https://example.com/feed.xml"}),
            ),
        )
        assert source_id > 0
        sources = list_sources(conn, scope="workspace", scope_key="")
        assert len(sources) == 1
        assert sources[0].name == "OpenAI Blog"

        inserted = insert_raw_items(
            conn,
            [
                IntelRawItem(
                    source_id=source_id,
                    title="OpenAI ships new model runtime",
                    url="https://example.com/post-1",
                    published_at="2026-03-17T02:00:00Z",
                    collected_at="2026-03-17T02:10:00Z",
                    summary_text="New runtime details for production AI systems.",
                    dedup_key=make_dedup_key(
                        "https://example.com/post-1",
                        "OpenAI ships new model runtime",
                        "2026-03-17T02:00:00Z",
                    ),
                )
            ],
        )
        assert inserted == 1

        recent = list_recent_raw_items(
            conn,
            scope="workspace",
            scope_key="",
            since_iso="2026-03-16T00:00:00Z",
        )
        assert len(recent) == 1
        assert recent[0].title == "OpenAI ships new model runtime"

        digest_id = build_daily_digest(
            conn,
            scope="workspace",
            scope_key="",
            now=datetime(2026, 3, 17, 6, 0, tzinfo=UTC),
            hours=48,
            limit=10,
        )
        assert digest_id > 0

        digests = list_digests(conn, digest_type="daily", scope="workspace", scope_key="", limit=5)
        assert len(digests) == 1
        assert "OpenAI ships new model runtime" in digests[0].body_markdown
        assert digests[0].title.startswith("Intel Daily Digest")
    finally:
        conn.close()


def test_intel_insert_raw_items_deduplicates_same_source(tmp_path) -> None:
    _, conn = _make_conn(tmp_path)
    try:
        source_id = add_source(
            conn,
            IntelSource(
                name="Anthropic News",
                source_type="rss",
                config_json=json.dumps({"url": "https://example.com/anthropic.xml"}),
            ),
        )
        item = IntelRawItem(
            source_id=source_id,
            title="Anthropic launches agent API",
            url="https://example.com/agent-api",
            published_at="2026-03-17T03:00:00Z",
            collected_at="2026-03-17T03:01:00Z",
            summary_text="API launch summary",
            dedup_key=make_dedup_key(
                "https://example.com/agent-api",
                "Anthropic launches agent API",
                "2026-03-17T03:00:00Z",
            ),
        )
        first = insert_raw_items(conn, [item])
        second = insert_raw_items(conn, [item])
        assert first == 1
        assert second == 0
    finally:
        conn.close()


def test_intel_search_service_bm25_finds_recent_items(tmp_path) -> None:
    workspace, conn = _make_conn(tmp_path)
    try:
        source_id = add_source(
            conn,
            IntelSource(
                name="Market Feed",
                source_type="rss",
                config_json=json.dumps({"url": "https://example.com/feed.xml"}),
            ),
        )
        inserted = insert_raw_items(
            conn,
            [
                IntelRawItem(
                    source_id=source_id,
                    title="AI chip demand pushes NVDA suppliers higher",
                    url="https://example.com/nvda-suppliers",
                    published_at="2026-03-19T09:00:00Z",
                    collected_at="2026-03-19T09:05:00Z",
                    content_text="Supply chain names gained after stronger AI chip demand signals.",
                    summary_text="AI chip supply chain strength",
                    dedup_key=make_dedup_key(
                        "https://example.com/nvda-suppliers",
                        "AI chip demand pushes NVDA suppliers higher",
                        "2026-03-19T09:00:00Z",
                    ),
                )
            ],
        )
        assert inserted == 1
    finally:
        conn.close()

    service = IntelSearchService(workspace)
    hits = service.search("AI chip demand", days=365, limit=3)
    assert len(hits) == 1
    assert hits[0].source_name == "Market Feed"
    assert "NVDA suppliers" in hits[0].title


def test_rss_collector_parses_entries(monkeypatch) -> None:
    collector = RssCollector()
    source = IntelSource(
        id=1,
        name="Test Feed",
        source_type="rss",
        config_json=json.dumps({"url": "https://example.com/feed.xml"}),
    )

    class _Parsed:
        bozo = 0
        entries = [
            type(
                "Entry",
                (),
                {
                    "title": "AI infra weekly",
                    "link": "https://example.com/weekly",
                    "author": "editor",
                    "summary": "Strong AI infra coverage",
                    "published": "Tue, 17 Mar 2026 10:00:00 GMT",
                },
            )()
        ]

    monkeypatch.setattr("marketbot.domain.intel.collector.feedparser.parse", lambda url: _Parsed())
    items = asyncio.run(collector.collect(source))
    assert len(items) == 1
    assert items[0].title == "AI infra weekly"
    assert items[0].url == "https://example.com/weekly"
    assert items[0].dedup_key


def test_intel_cli_source_add_and_digest_daily(tmp_path) -> None:
    config = Config()
    config.agents.defaults.workspace = str(tmp_path / "workspace")

    with patch("marketbot.config.loader.load_config", return_value=config):
        add_result = runner.invoke(
            app,
            [
                "intel",
                "source-add",
                "--type",
                "rss",
                "--name",
                "OpenAI Blog",
                "--url",
                "https://example.com/feed.xml",
            ],
        )
        assert add_result.exit_code == 0
        assert "Added intel source" in add_result.stdout

        digest_result = runner.invoke(
            app,
            [
                "intel",
                "digest-daily",
                "--hours",
                "24",
                "--limit",
                "5",
            ],
        )
        assert digest_result.exit_code == 0
        assert "Built digest" in digest_result.stdout
        assert "Intel Daily Digest" in digest_result.stdout


def test_intel_cli_collect_returns_nonzero_when_all_sources_fail(tmp_path) -> None:
    config = Config()
    config.agents.defaults.workspace = str(tmp_path / "workspace")

    with patch("marketbot.config.loader.load_config", return_value=config):
        add_result = runner.invoke(
            app,
            [
                "intel",
                "source-add",
                "--type",
                "rss",
                "--name",
                "Broken Feed",
                "--url",
                "https://example.com/feed.xml",
            ],
        )
        assert add_result.exit_code == 0

        with patch(
            "marketbot.domain.intel.collector.IntelCollectorService.collect_source",
            new=AsyncMock(side_effect=RuntimeError("dns lookup failed")),
        ):
            collect_result = runner.invoke(app, ["intel", "collect"])

    assert collect_result.exit_code == 1
    assert "dns lookup failed" in collect_result.stdout


def test_intel_cli_digest_list_and_show(tmp_path) -> None:
    config = Config()
    config.agents.defaults.workspace = str(tmp_path / "workspace")

    with patch("marketbot.config.loader.load_config", return_value=config):
        runner.invoke(
            app,
            [
                "intel",
                "source-add",
                "--type",
                "rss",
                "--name",
                "OpenAI Blog",
                "--url",
                "https://example.com/feed.xml",
            ],
        )
        runner.invoke(
            app,
            [
                "intel",
                "digest-daily",
                "--hours",
                "24",
                "--limit",
                "5",
                "--no-save",
            ],
        )
        list_result = runner.invoke(app, ["intel", "digest-list"])

    assert list_result.exit_code == 0
    assert "Intel Digests" in list_result.stdout
    assert "Intel Daily Digest" in list_result.stdout

    with patch("marketbot.config.loader.load_config", return_value=config):
        show_result = runner.invoke(app, ["intel", "digest-show", "1"])
    assert show_result.exit_code == 0
    assert "Digest #1" in show_result.stdout
    assert "Intel Daily Digest" in show_result.stdout


def test_intel_cli_digest_show_rejects_missing_digest(tmp_path) -> None:
    config = Config()
    config.agents.defaults.workspace = str(tmp_path / "workspace")

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(app, ["intel", "digest-show", "999"])

    assert result.exit_code != 0
    assert "Intel digest not found: 999" in result.stdout


def test_intel_cli_schedule_collect_writes_intel_job(tmp_path) -> None:
    config = Config()
    config.agents.defaults.workspace = str(tmp_path / "workspace")

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(
            app,
            [
                "intel",
                "schedule-collect",
                "--every-minutes",
                "30",
            ],
        )

    assert result.exit_code == 0
    assert "Scheduled intel collect job" in result.stdout
    jobs_path = Path(config.workspace_path) / "cron" / "jobs.json"
    payload = json.loads(jobs_path.read_text(encoding="utf-8"))
    assert payload["jobs"][0]["payload"]["kind"] == "intel_collect"
    assert payload["jobs"][0]["payload"]["scope"] == "workspace"


def test_intel_cli_schedule_daily_writes_delivery_options(tmp_path) -> None:
    config = Config()
    config.agents.defaults.workspace = str(tmp_path / "workspace")

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(
            app,
            [
                "intel",
                "schedule-daily",
                "--cron-expr",
                "0 9 * * *",
                "--tz",
                "Asia/Shanghai",
                "--deliver",
                "--channel",
                "telegram",
                "--to",
                "chat-1",
                "--hours",
                "12",
                "--limit",
                "8",
            ],
        )

    assert result.exit_code == 0
    assert "Scheduled intel daily digest job" in result.stdout
    jobs_path = Path(config.workspace_path) / "cron" / "jobs.json"
    payload = json.loads(jobs_path.read_text(encoding="utf-8"))
    job_payload = payload["jobs"][0]["payload"]
    assert job_payload["kind"] == "intel_digest_daily"
    assert job_payload["deliver"] is True
    assert job_payload["channel"] == "telegram"
    assert job_payload["to"] == "chat-1"
    assert job_payload["hours"] == 12
    assert job_payload["limit"] == 8


def test_intel_cli_schedule_latest_daily_creates_collect_and_digest_jobs(tmp_path) -> None:
    config = Config()
    config.agents.defaults.workspace = str(tmp_path / "workspace")

    with patch("marketbot.config.loader.load_config", return_value=config):
        result = runner.invoke(
            app,
            [
                "intel",
                "schedule-latest-daily",
                "--collect-cron-expr",
                "55 7 * * *",
                "--digest-cron-expr",
                "0 8 * * *",
                "--tz",
                "Asia/Shanghai",
                "--deliver",
                "--channel",
                "telegram",
                "--to",
                "chat-1",
            ],
        )

    assert result.exit_code == 0
    assert "Scheduled latest intel daily workflow" in result.stdout
    jobs_path = Path(config.workspace_path) / "cron" / "jobs.json"
    payload = json.loads(jobs_path.read_text(encoding="utf-8"))
    assert len(payload["jobs"]) == 2
    assert payload["jobs"][0]["payload"]["kind"] == "intel_collect"
    assert payload["jobs"][0]["schedule"]["expr"] == "55 7 * * *"
    assert payload["jobs"][1]["payload"]["kind"] == "intel_digest_daily"
    assert payload["jobs"][1]["schedule"]["expr"] == "0 8 * * *"
    assert payload["jobs"][1]["payload"]["deliver"] is True
    assert payload["jobs"][1]["payload"]["channel"] == "telegram"
    assert payload["jobs"][1]["payload"]["to"] == "chat-1"


def test_intel_cli_schedule_list_shows_intel_jobs_only(tmp_path) -> None:
    config = Config()
    config.agents.defaults.workspace = str(tmp_path / "workspace")

    with patch("marketbot.config.loader.load_config", return_value=config):
        runner.invoke(app, ["intel", "schedule-collect", "--every-minutes", "30"])
        result = runner.invoke(app, ["intel", "schedule-list"])

    assert result.exit_code == 0
    assert "Intel Scheduled Jobs" in result.stdout
    assert "intel_collect" in result.stdout


def test_intel_cli_schedule_remove_deletes_job(tmp_path) -> None:
    config = Config()
    config.agents.defaults.workspace = str(tmp_path / "workspace")

    with patch("marketbot.config.loader.load_config", return_value=config):
        runner.invoke(app, ["intel", "schedule-collect", "--every-minutes", "30"])
        jobs_path = Path(config.workspace_path) / "cron" / "jobs.json"
        payload = json.loads(jobs_path.read_text(encoding="utf-8"))
        job_id = payload["jobs"][0]["id"]

        remove_result = runner.invoke(app, ["intel", "schedule-remove", job_id])

    assert remove_result.exit_code == 0
    assert f"Removed intel scheduled job {job_id}" in remove_result.stdout
    payload = json.loads(jobs_path.read_text(encoding="utf-8"))
    assert payload["jobs"] == []
