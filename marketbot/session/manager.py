"""Session management for conversation history."""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from loguru import logger

from marketbot.session import storage
from marketbot.utils.helpers import ensure_dir


@dataclass
class Session:
    """
    A conversation session.

    Stores messages in JSONL format for easy reading and persistence.

    Important: Messages are append-only for LLM cache efficiency.
    The consolidation process writes summaries to MEMORY.md/HISTORY.md
    but does NOT modify the messages list or get_history() output.
    """

    key: str  # channel:chat_id
    messages: list[dict[str, Any]] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)
    last_consolidated: int = 0  # Number of messages already consolidated to files
    _persisted_messages: int = field(default=0, repr=False, compare=False)
    _metadata_records: int = field(default=0, repr=False, compare=False)

    def add_message(self, role: str, content: str, **kwargs: Any) -> None:
        """Add a message to the session."""
        msg = {
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat(),
            **kwargs
        }
        self.messages.append(msg)
        self.updated_at = datetime.now()

    def get_history(self, max_messages: int = 500, max_turns: int | None = None) -> list[dict[str, Any]]:
        """Return unconsolidated messages for LLM input, aligned to a user turn."""
        unconsolidated = self.messages[self.last_consolidated:]
        sliced = unconsolidated[-max_messages:]

        if max_turns and max_turns > 0 and sliced:
            user_turns = 0
            start = 0
            for i in range(len(sliced) - 1, -1, -1):
                if sliced[i].get("role") == "user":
                    user_turns += 1
                    if user_turns >= max_turns:
                        start = i
                        break
            sliced = sliced[start:]

        # Drop leading non-user messages to avoid orphaned tool_result blocks
        for i, m in enumerate(sliced):
            if m.get("role") == "user":
                sliced = sliced[i:]
                break

        out: list[dict[str, Any]] = []
        for m in sliced:
            entry: dict[str, Any] = {"role": m["role"], "content": m.get("content", "")}
            for k in ("tool_calls", "tool_call_id", "name"):
                if k in m:
                    entry[k] = m[k]
            out.append(entry)
        return out

    def clear(self) -> None:
        """Clear all messages and reset session to initial state."""
        self.messages = []
        self.last_consolidated = 0
        self.updated_at = datetime.now()


class SessionManager:
    """
    Manages conversation sessions.

    Sessions are stored as JSONL files in the sessions directory.
    """

    def __init__(self, workspace: Path):
        self.workspace = workspace
        self.sessions_dir = ensure_dir(self.workspace / "sessions")
        self.legacy_sessions_dir = Path.home() / ".marketbot" / "sessions"
        self._cache: dict[str, Session] = {}

    def _get_session_path(self, key: str) -> Path:
        """Get the file path for a session."""
        return storage.session_path(self.sessions_dir, key)

    def _get_legacy_session_path(self, key: str) -> Path:
        """Legacy global session path (~/.marketbot/sessions/)."""
        return storage.legacy_session_path(self.legacy_sessions_dir, key)

    def get_or_create(self, key: str) -> Session:
        """
        Get an existing session or create a new one.

        Args:
            key: Session key (usually channel:chat_id).

        Returns:
            The session.
        """
        if key in self._cache:
            return self._cache[key]

        session = self._load(key)
        if session is None:
            session = Session(key=key)

        self._cache[key] = session
        return session

    def _load(self, key: str) -> Session | None:
        """Load a session from disk."""
        path = self._get_session_path(key)
        if not path.exists():
            legacy_path = self._get_legacy_session_path(key)
            if legacy_path.exists():
                storage.migrate_legacy_session(key, path, legacy_path)

        if not path.exists():
            return None

        try:
            payload = storage.load_session_jsonl(path)

            return Session(
                key=key,
                messages=payload["messages"],
                created_at=payload["created_at"] or datetime.now(),
                updated_at=payload["updated_at"] or datetime.now(),
                metadata=payload["metadata"],
                last_consolidated=payload["last_consolidated"],
                _persisted_messages=len(payload["messages"]),
                _metadata_records=payload.get("metadata_records", 1),
            )
        except Exception as e:
            logger.warning("Failed to load session {}: {}", key, e)
            return None

    def save(self, session: Session) -> None:
        """Save a session to disk."""
        self._save_to_disk(session)
        self._cache[session.key] = session

    async def save_async(self, session: Session) -> None:
        """Save a session to disk without blocking the event loop."""
        snapshot = Session(
            key=session.key,
            messages=[dict(message) for message in session.messages],
            created_at=session.created_at,
            updated_at=session.updated_at,
            metadata=dict(session.metadata),
            last_consolidated=session.last_consolidated,
            _persisted_messages=session._persisted_messages,
            _metadata_records=session._metadata_records,
        )
        await asyncio.to_thread(self._save_to_disk, snapshot)
        session._persisted_messages = snapshot._persisted_messages
        session._metadata_records = snapshot._metadata_records
        self._cache[session.key] = session

    def _save_to_disk(self, session: Session) -> None:
        """Persist a session snapshot to disk."""
        path = self._get_session_path(session.key)
        should_compact = (
            not path.exists()
            or session._persisted_messages > len(session.messages)
            or session._metadata_records >= 8
        )
        if should_compact:
            storage.save_session_jsonl(
                path,
                key=session.key,
                created_at=session.created_at,
                updated_at=session.updated_at,
                metadata=session.metadata,
                last_consolidated=session.last_consolidated,
                messages=session.messages,
            )
            session._persisted_messages = len(session.messages)
            session._metadata_records = 1
            return

        new_messages = session.messages[session._persisted_messages:]
        storage.append_session_jsonl(
            path,
            key=session.key,
            created_at=session.created_at,
            updated_at=session.updated_at,
            metadata=session.metadata,
            last_consolidated=session.last_consolidated,
            messages=new_messages,
        )
        session._persisted_messages = len(session.messages)
        session._metadata_records += 1

    def invalidate(self, key: str) -> None:
        """Remove a session from the in-memory cache."""
        self._cache.pop(key, None)

    def list_sessions(self) -> list[dict[str, Any]]:
        """
        List all sessions.

        Returns:
            List of session info dicts.
        """
        sessions = []

        for path in self.sessions_dir.glob("*.jsonl"):
            try:
                data = storage.load_session_index(path)
                if data:
                    key = data.get("key") or path.stem.replace("_", ":", 1)
                    sessions.append({
                        "key": key,
                        "created_at": data.get("created_at"),
                        "updated_at": data.get("updated_at"),
                        "path": str(path),
                    })
            except Exception:
                continue

        return sorted(sessions, key=lambda x: x.get("updated_at", ""), reverse=True)

    def stats(self) -> dict[str, Any]:
        """Return lightweight observability stats for session storage and cache."""
        session_files = list(self.sessions_dir.glob("*.jsonl"))
        legacy_files = list(self.legacy_sessions_dir.glob("*.jsonl")) if self.legacy_sessions_dir.exists() else []
        cached_sessions = list(self._cache.values())
        cached_messages = sum(len(session.messages) for session in cached_sessions)
        stored_bytes = sum(path.stat().st_size for path in session_files if path.exists())
        return {
            "workspacePath": str(self.sessions_dir),
            "storedSessions": len(session_files),
            "storedBytes": stored_bytes,
            "legacySessions": len(legacy_files),
            "cachedSessions": len(cached_sessions),
            "cachedMessages": cached_messages,
            "compactMetadataThreshold": 8,
        }
