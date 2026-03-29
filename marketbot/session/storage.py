"""JSONL session storage helpers."""

import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

from loguru import logger

from marketbot.utils.helpers import safe_filename


def session_path(sessions_dir: Path, key: str) -> Path:
    """Return the workspace-scoped session path for a session key."""
    safe_key = safe_filename(key.replace(":", "_"))
    return sessions_dir / f"{safe_key}.jsonl"


def legacy_session_path(legacy_sessions_dir: Path, key: str) -> Path:
    """Return the legacy global session path for a session key."""
    safe_key = safe_filename(key.replace(":", "_"))
    return legacy_sessions_dir / f"{safe_key}.jsonl"


def migrate_legacy_session(key: str, path: Path, legacy_path: Path) -> None:
    """Move a legacy session file into the workspace session directory."""
    try:
        shutil.move(str(legacy_path), str(path))
        logger.info("Migrated session {} from legacy path", key)
    except Exception:
        logger.exception("Failed to migrate session {}", key)


def load_session_jsonl(path: Path) -> dict[str, Any]:
    """Load session metadata and messages from a JSONL session file."""
    messages: list[dict[str, Any]] = []
    metadata: dict[str, Any] = {}
    created_at = None
    updated_at = None
    last_consolidated = 0
    metadata_records = 0

    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue

            data = json.loads(line)
            if data.get("_type") == "metadata":
                metadata_records += 1
                metadata = data.get("metadata", {})
                created_at = datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None
                updated_at = datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else None
                last_consolidated = data.get("last_consolidated", 0)
            else:
                messages.append(data)

    return {
        "messages": messages,
        "metadata": metadata,
        "created_at": created_at,
        "updated_at": updated_at,
        "last_consolidated": last_consolidated,
        "metadata_records": metadata_records,
    }


def save_session_jsonl(
    path: Path,
    *,
    key: str,
    created_at: datetime,
    updated_at: datetime,
    metadata: dict[str, Any],
    last_consolidated: int,
    messages: list[dict[str, Any]],
) -> None:
    """Persist a session to the canonical JSONL layout."""
    with open(path, "w", encoding="utf-8") as handle:
        metadata_line = build_metadata_line(
            key=key,
            created_at=created_at,
            updated_at=updated_at,
            metadata=metadata,
            last_consolidated=last_consolidated,
        )
        handle.write(json.dumps(metadata_line, ensure_ascii=False) + "\n")
        for message in messages:
            handle.write(json.dumps(message, ensure_ascii=False) + "\n")


def append_session_jsonl(
    path: Path,
    *,
    key: str,
    created_at: datetime,
    updated_at: datetime,
    metadata: dict[str, Any],
    last_consolidated: int,
    messages: list[dict[str, Any]],
) -> None:
    """Append a new metadata record plus only the newly added messages."""
    with open(path, "a", encoding="utf-8") as handle:
        metadata_line = build_metadata_line(
            key=key,
            created_at=created_at,
            updated_at=updated_at,
            metadata=metadata,
            last_consolidated=last_consolidated,
        )
        handle.write(json.dumps(metadata_line, ensure_ascii=False) + "\n")
        for message in messages:
            handle.write(json.dumps(message, ensure_ascii=False) + "\n")


def load_session_index(path: Path) -> dict[str, Any] | None:
    """Read the latest metadata line for session listing."""
    with open(path, encoding="utf-8") as handle:
        latest = None
        for line in handle:
            line = line.strip()
            if not line:
                continue
            data = json.loads(line)
            if data.get("_type") == "metadata":
                latest = data
        return latest


def build_metadata_line(
    *,
    key: str,
    created_at: datetime,
    updated_at: datetime,
    metadata: dict[str, Any],
    last_consolidated: int,
) -> dict[str, Any]:
    """Build the canonical session metadata line payload."""
    return {
        "_type": "metadata",
        "key": key,
        "created_at": created_at.isoformat(),
        "updated_at": updated_at.isoformat(),
        "metadata": metadata,
        "last_consolidated": last_consolidated,
    }
