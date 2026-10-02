"""JSONL session storage helpers."""

import hashlib
import io
import json
import os
import re
import shutil
import tempfile
import threading
from contextlib import contextmanager
from datetime import datetime
from functools import wraps
from pathlib import Path
from typing import Any

from loguru import logger

from marketbot.utils.helpers import safe_filename

try:
    import fcntl
except ImportError:  # pragma: no cover - Windows uses the stdlib byte-range lock.
    fcntl = None

_HELD_FILE_LOCKS = threading.local()


class SessionStorageError(RuntimeError):
    """Session storage cannot be safely read or replaced."""


class SessionIdentityError(SessionStorageError):
    """A file does not prove ownership of the requested session identity."""


class SessionConflictError(SessionStorageError):
    """A stale writer must reload rather than overwrite another writer's messages."""

    retryable = True


@contextmanager
def session_file_lock(path: Path):
    """Serialize each session file across threads/processes, with same-thread nesting."""
    identity = (os.getpid(), str(path.absolute()))
    held = getattr(_HELD_FILE_LOCKS, "paths", None)
    if held is None:
        held = _HELD_FILE_LOCKS.paths = set()
    if identity in held:
        yield
        return
    lock_name = ".session-" + hashlib.sha256(path.name.encode("utf-8")).hexdigest() + ".lock"
    lock_path = path.parent / lock_name
    _check_file(path)
    _check_file(lock_path)
    descriptor = None
    locked = False
    try:
        descriptor = os.open(lock_path, os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0), 0o600)
        if fcntl is not None:
            fcntl.flock(descriptor, fcntl.LOCK_EX)
        else:  # pragma: no cover
            import msvcrt

            if not os.fstat(descriptor).st_size:
                os.write(descriptor, b"\0")
            os.lseek(descriptor, 0, os.SEEK_SET)
            msvcrt.locking(descriptor, msvcrt.LK_LOCK, 1)
        locked = True
        held.add(identity)
        yield
    except OSError:
        raise SessionStorageError("Unable to lock session storage; existing messages were preserved") from None
    finally:
        if descriptor is not None:
            if locked:
                held.discard(identity)
                if fcntl is not None:
                    fcntl.flock(descriptor, fcntl.LOCK_UN)
                else:  # pragma: no cover
                    import msvcrt

                    os.lseek(descriptor, 0, os.SEEK_SET)
                    msvcrt.locking(descriptor, msvcrt.LK_UNLCK, 1)
            os.close(descriptor)


def _locked_session_file(method):
    @wraps(method)
    def locked(path, *args, **kwargs):
        with session_file_lock(path):
            return method(path, *args, **kwargs)

    return locked


def message_digest(messages: list[dict[str, Any]]) -> str:
    """Identify the saved baseline even when a user explicitly clears local messages."""
    try:
        encoded = json.dumps(messages, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
        return hashlib.sha256(encoded.encode("utf-8")).hexdigest()
    except (ValueError, TypeError, UnicodeError):
        raise SessionStorageError("Session messages are not valid finite JSON") from None


def _validate_key(key: str) -> None:
    if not isinstance(key, str) or not key.strip() or any(ord(char) < 32 for char in key):
        raise SessionIdentityError("Invalid session identity")
    try:
        key.encode("utf-8")
    except UnicodeError:
        raise SessionIdentityError("Invalid session identity") from None


def _check_file(path: Path) -> None:
    if path.is_symlink() or (path.exists() and not path.is_file()):
        raise SessionStorageError("Session storage path is unsafe")


def session_path(sessions_dir: Path, key: str) -> Path:
    """Return a collision-resistant workspace path preserving the full session identity."""
    _validate_key(key)
    prefix = re.sub(r"[^A-Za-z0-9_.-]", "_", key).strip("._")[:64] or "session"
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    return sessions_dir / f"{prefix}-{digest}.jsonl"


def legacy_session_path(legacy_sessions_dir: Path, key: str) -> Path:
    """Return the old unhashed path, only for identity-checked migration."""
    _validate_key(key)
    safe_key = safe_filename(key.replace(":", "_"))
    return legacy_sessions_dir / f"{safe_key}.jsonl"


def migrate_legacy_session(key: str, path: Path, legacy_path: Path) -> None:
    """Publish a verified legacy file without overwriting another session's file."""
    with session_file_lock(path):
        if path.exists():
            load_session_jsonl(path, expected_key=key)
            return
        with session_file_lock(legacy_path):
            _migrate_locked(key, path, legacy_path)


def _migrate_locked(key: str, path: Path, legacy_path: Path) -> None:
    _check_file(path)
    if path.exists():
        load_session_jsonl(path, expected_key=key)
        return
    _check_file(legacy_path)
    load_session_jsonl(legacy_path, expected_key=key)
    temporary = None
    try:
        fd, name = tempfile.mkstemp(prefix=".session-", suffix=".jsonl", dir=path.parent)
        os.close(fd)
        temporary = Path(name)
        shutil.copyfile(legacy_path, temporary)
        load_session_jsonl(temporary, expected_key=key)
        try:
            os.link(temporary, path)
        except FileExistsError:
            load_session_jsonl(path, expected_key=key)
            return
        legacy_path.unlink()
        logger.info("Migrated session {} from legacy path", key)
    except OSError:
        raise SessionStorageError("Unable to migrate session; original file was preserved") from None
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


@_locked_session_file
def load_session_jsonl(path: Path, *, expected_key: str | None = None) -> dict[str, Any]:
    """Load a session, validating every metadata identity when one is expected."""
    _check_file(path)
    if expected_key is not None:
        _validate_key(expected_key)
    messages: list[dict[str, Any]] = []
    metadata: dict[str, Any] = {}
    created_at = None
    updated_at = None
    last_consolidated = 0
    metadata_records = 0
    identity = expected_key

    try:
        with open(path, encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue

                data = json.loads(line)
                if not isinstance(data, dict):
                    raise ValueError
                if data.get("_type") == "metadata":
                    key = data.get("key")
                    if not isinstance(key, str) or not key.strip():
                        raise SessionIdentityError("Session metadata does not prove its identity; file preserved")
                    if identity is None:
                        identity = key
                    if key != identity:
                        raise SessionIdentityError("Session metadata identity conflict; file preserved")
                    metadata_records += 1
                    metadata = data.get("metadata", {})
                    if not isinstance(metadata, dict):
                        raise ValueError
                    created_at = datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None
                    updated_at = datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else None
                    last_consolidated = data.get("last_consolidated", 0)
                    if not isinstance(last_consolidated, int) or isinstance(last_consolidated, bool) or last_consolidated < 0:
                        raise ValueError
                else:
                    messages.append(data)
    except (OSError, ValueError, TypeError, UnicodeError):
        raise SessionStorageError("Session storage is corrupt or unavailable; file preserved") from None
    if not metadata_records:
        raise SessionIdentityError("Session metadata does not prove its identity; file preserved")

    return {
        "messages": messages,
        "metadata": metadata,
        "created_at": created_at,
        "updated_at": updated_at,
        "last_consolidated": last_consolidated,
        "metadata_records": metadata_records,
        "key": identity,
    }


@_locked_session_file
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
    """Atomically replace a verified session, preserving corrupt/conflicting files."""
    _check_file(path)
    if path.exists():
        load_session_jsonl(path, expected_key=key)
    temporary = None
    try:
        fd, name = tempfile.mkstemp(prefix=".session-", suffix=".jsonl", dir=path.parent)
        temporary = Path(name)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            _write_session_lines(handle, key=key, created_at=created_at, updated_at=updated_at, metadata=metadata, last_consolidated=last_consolidated, messages=messages)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    except (OSError, ValueError, TypeError):
        raise SessionStorageError("Unable to save session; existing file was preserved") from None
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def _write_session_lines(handle, *, key, created_at, updated_at, metadata, last_consolidated, messages):
    _validate_key(key)
    metadata_line = build_metadata_line(
        key=key,
        created_at=created_at,
        updated_at=updated_at,
        metadata=metadata,
        last_consolidated=last_consolidated,
    )
    handle.write(json.dumps(metadata_line, ensure_ascii=False, allow_nan=False) + "\n")
    for message in messages:
        handle.write(json.dumps(message, ensure_ascii=False, allow_nan=False) + "\n")


@_locked_session_file
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
    _check_file(path)
    if path.exists():
        load_session_jsonl(path, expected_key=key)
    # Serialize the complete append first: invalid input must not leave partial
    # metadata/messages in an otherwise valid session.
    buffer = io.StringIO()
    try:
        _write_session_lines(buffer, key=key, created_at=created_at, updated_at=updated_at, metadata=metadata, last_consolidated=last_consolidated, messages=messages)
        encoded = buffer.getvalue()
        encoded.encode("utf-8")
    except (ValueError, TypeError, UnicodeError):
        raise SessionStorageError("Unable to append session; existing file was preserved") from None
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(encoded)


@_locked_session_file
def load_session_index(path: Path) -> dict[str, Any] | None:
    """Read the latest metadata line for session listing."""
    load_session_jsonl(path)  # Validate identities throughout the file, not only the last line.
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
