"""Shared runtime diagnostics helpers."""

from __future__ import annotations

from typing import Any


def collect_bus_diagnostics(bus: Any) -> dict[str, Any]:
    """Collect machine-readable bus diagnostics when available."""
    if bus is None or not hasattr(bus, "stats"):
        return {}
    stats = bus.stats()
    if not isinstance(stats, dict):
        return {}
    return {"bus": stats}


def format_bus_runtime_summary(bus: Any) -> str:
    """Render a compact queue/backpressure summary for startup logs."""
    diagnostics = collect_bus_diagnostics(bus)
    if not diagnostics:
        return "Bus: unavailable"
    inbound = diagnostics["bus"].get("inbound", {})
    outbound = diagnostics["bus"].get("outbound", {})
    return (
        "Bus: "
        + f"in={inbound.get('size', 0)}/{inbound.get('maxsize', 0)}"
        + f" published={inbound.get('published', 0)}"
        + f" wait={float(inbound.get('publish_wait_s', 0.0)):.3f}s"
        + " | "
        + f"out={outbound.get('size', 0)}/{outbound.get('maxsize', 0)}"
        + f" published={outbound.get('published', 0)}"
        + f" wait={float(outbound.get('publish_wait_s', 0.0)):.3f}s"
    )
