"""Session management for conversation history."""

import asyncio
from copy import deepcopy
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
    _persisted_digest: str | None = field(default=None, repr=False, compare=False)

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
            entry: dict[str, Any] = {"role": m["role"], "content": deepcopy(m.get("content", ""))}
            for k in ("tool_calls", "tool_call_id", "name"):
                if k in m:
                    entry[k] = deepcopy(m[k])
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
        self.workspace = workspace.expanduser().resolve()
        if (self.workspace / "sessions").is_symlink():
            raise storage.SessionStorageError("Session storage must remain inside its workspace")
        self.sessions_dir = ensure_dir(self.workspace / "sessions")
        self.legacy_sessions_dir = Path.home() / ".marketbot" / "sessions"
        self._cache: dict[str, Session] = {}

    def _get_session_path(self, key: str) -> Path:
        """Get the file path for a session."""
        if self.sessions_dir.is_symlink() or not self.sessions_dir.resolve().is_relative_to(self.workspace):
            raise storage.SessionStorageError("Session storage must remain inside its workspace")
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
            for legacy_path in (
                storage.legacy_session_path(self.sessions_dir, key),
                self._get_legacy_session_path(key),
            ):
                try:
                    exists = legacy_path.exists()
                except OSError:
                    # Old unhashed filenames can exceed platform limits, while
                    # the new full-identity hash remains bounded and usable.
                    continue
                if exists:
                    try:
                        with storage.session_file_lock(path):
                            storage.migrate_legacy_session(key, path, legacy_path)
                    except storage.SessionIdentityError:
                        logger.warning("Legacy session identity conflict; original file preserved")
                        continue
                    break

        if not path.exists():
            return None

        try:
            payload = storage.load_session_jsonl(path, expected_key=key)

            return Session(
                key=key,
                messages=payload["messages"],
                created_at=payload["created_at"] or datetime.now(),
                updated_at=payload["updated_at"] or datetime.now(),
                metadata=payload["metadata"],
                last_consolidated=payload["last_consolidated"],
                _persisted_messages=len(payload["messages"]),
                _metadata_records=payload.get("metadata_records", 1),
                _persisted_digest=storage.message_digest(payload["messages"]),
            )
        except storage.SessionStorageError:
            logger.warning("Session could not be loaded safely; original file preserved")
            raise

    def save(self, session: Session) -> None:
        """Save a session to disk."""
        try:
            self._save_to_disk(session)
        except storage.SessionConflictError:
            self.invalidate(session.key)
            raise
        self._cache[session.key] = session

    async def save_async(self, session: Session) -> None:
        """Save a session to disk without blocking the event loop."""
        snapshot = Session(
            key=session.key,
            messages=deepcopy(session.messages),
            created_at=session.created_at,
            updated_at=session.updated_at,
            metadata=deepcopy(session.metadata),
            last_consolidated=session.last_consolidated,
            _persisted_messages=session._persisted_messages,
            _metadata_records=session._metadata_records,
            _persisted_digest=session._persisted_digest,
        )
        try:
            await asyncio.to_thread(self._save_to_disk, snapshot)
        except storage.SessionConflictError:
            self.invalidate(session.key)
            raise
        session._persisted_messages = snapshot._persisted_messages
        session._metadata_records = snapshot._metadata_records
        session._persisted_digest = snapshot._persisted_digest
        self._cache[session.key] = session

    def _save_to_disk(self, session: Session) -> None:
        """Persist a session snapshot to disk."""
        path = self._get_session_path(session.key)
        with storage.session_file_lock(path):
            self._save_locked(session, path)

    @staticmethod
    def _save_locked(session: Session, path: Path) -> None:
        snapshot_digest = storage.message_digest(session.messages)
        stored = storage.load_session_jsonl(path, expected_key=session.key) if path.exists() else None
        reset = session._persisted_messages > len(session.messages)
        if stored is not None:
            stored_messages = stored["messages"]
            if reset:
                if session._persisted_digest != storage.message_digest(stored_messages):
                    raise storage.SessionConflictError("Session changed in another writer; reload this session and retry. Existing messages were preserved.")
            elif len(stored_messages) < session._persisted_messages or stored_messages != session.messages[:len(stored_messages)]:
                raise storage.SessionConflictError("Session message history conflicts with another writer; reload this session and retry. Existing messages were preserved.")
        elif session._persisted_messages:
            raise storage.SessionConflictError("Saved session disappeared; reload this session and retry. Existing in-memory messages were preserved.")
        should_compact = (
            stored is None
            or reset
            or stored["metadata_records"] >= 8
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
            session._persisted_digest = snapshot_digest
            return

        new_messages = session.messages[len(stored["messages"]):]
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
        session._metadata_records = stored["metadata_records"] + 1
        session._persisted_digest = snapshot_digest

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
