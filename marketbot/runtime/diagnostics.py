"""Shared runtime diagnostics helpers."""

from __future__ import annotations

from typing import Any


def collect_runtime_diagnostics(*, bus: Any = None, session_manager: Any = None) -> dict[str, Any]:
    """Collect shared runtime diagnostics from optional subsystems."""
    payload: dict[str, Any] = {}
    payload.update(collect_bus_diagnostics(bus))
    payload.update(collect_session_diagnostics(session_manager))
    return payload


def collect_bus_diagnostics(bus: Any) -> dict[str, Any]:
    """Collect machine-readable bus diagnostics when available."""
    if bus is None or not hasattr(bus, "stats"):
        return {}
    stats = bus.stats()
    if not isinstance(stats, dict):
        return {}
    return {"bus": stats}


def collect_session_diagnostics(session_manager: Any) -> dict[str, Any]:
    """Collect machine-readable session diagnostics when available."""
    if session_manager is None or not hasattr(session_manager, "stats"):
        return {}
    stats = session_manager.stats()
    if not isinstance(stats, dict):
        return {}
    return {"sessions": stats}


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
