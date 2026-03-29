from marketbot.runtime.diagnostics import collect_bus_diagnostics, format_bus_runtime_summary


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


def test_format_bus_runtime_summary_uses_shared_payload() -> None:
    class _Bus:
        @staticmethod
        def stats():
            return {
                "inbound": {"size": 1, "maxsize": 10, "published": 2, "publish_wait_s": 0.5},
                "outbound": {"size": 0, "maxsize": 10, "published": 3, "publish_wait_s": 0.25},
            }

    assert format_bus_runtime_summary(_Bus()) == "Bus: in=1/10 published=2 wait=0.500s | out=0/10 published=3 wait=0.250s"
