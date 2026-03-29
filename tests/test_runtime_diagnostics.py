from marketbot.runtime.diagnostics import (
    collect_bus_diagnostics,
    collect_runtime_diagnostics,
    collect_session_diagnostics,
    format_bus_runtime_summary,
)


def test_collect_bus_diagnostics_handles_missing_bus() -> None:
    assert collect_bus_diagnostics(None) == {}


def test_collect_bus_diagnostics_returns_bus_stats() -> None:
    class _Bus:
        @staticmethod
        def stats():
            return {
                "inbound": {"size": 1, "maxsize": 10, "published": 2, "publish_wait_s": 0.5},
                "outbound": {"size": 0, "maxsize": 10, "published": 3, "publish_wait_s": 0.25},
            }

    payload = collect_bus_diagnostics(_Bus())

    assert payload["bus"]["inbound"]["published"] == 2
    assert payload["bus"]["outbound"]["published"] == 3


def test_collect_session_diagnostics_returns_session_stats() -> None:
    class _Sessions:
        @staticmethod
        def stats():
            return {"storedSessions": 2, "cachedSessions": 1, "cachedMessages": 5}

    payload = collect_session_diagnostics(_Sessions())

    assert payload["sessions"]["storedSessions"] == 2
    assert payload["sessions"]["cachedMessages"] == 5


def test_collect_runtime_diagnostics_merges_bus_and_sessions() -> None:
    class _Bus:
        @staticmethod
        def stats():
            return {"inbound": {"size": 1}, "outbound": {"size": 2}}

    class _Sessions:
        @staticmethod
        def stats():
            return {"storedSessions": 2, "cachedSessions": 1, "cachedMessages": 5}

    payload = collect_runtime_diagnostics(bus=_Bus(), session_manager=_Sessions())

    assert payload["bus"]["inbound"]["size"] == 1
    assert payload["sessions"]["storedSessions"] == 2


def test_format_bus_runtime_summary_uses_shared_payload() -> None:
    class _Bus:
        @staticmethod
        def stats():
            return {
                "inbound": {"size": 1, "maxsize": 10, "published": 2, "publish_wait_s": 0.5},
                "outbound": {"size": 0, "maxsize": 10, "published": 3, "publish_wait_s": 0.25},
            }

    assert format_bus_runtime_summary(_Bus()) == "Bus: in=1/10 published=2 wait=0.500s | out=0/10 published=3 wait=0.250s"
