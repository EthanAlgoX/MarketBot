#!/usr/bin/env python3
"""Back up only this project's dev data and verify restore into disposable targets."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import signal
import sqlite3
import subprocess
import sys
import time
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / ".local"
spec = importlib.util.spec_from_file_location("finance_dev", ROOT / "scripts/finance-dev.py")
dev = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dev)


def private_json(path, value):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w") as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")
    path.chmod(0o600)


def run(args, env, log=None):
    result = subprocess.run(args, env=env, capture_output=True, text=True)
    if log:
        descriptor = os.open(log, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
        with os.fdopen(descriptor, "a") as stream:
            stream.write(result.stdout + result.stderr)
    if result.returncode:
        raise RuntimeError("Backup/restore database operation failed; inspect its private log.")
    return result.stdout


def verification_owner(folder):
    folder = within_local(folder)
    if folder.parent != (LOCAL / "verify").resolve() or not re.fullmatch(r"[0-9a-f]{16}", folder.name):
        raise RuntimeError("Verification scope requires this project's retained random verification directory.")
    owner = json.loads((folder / "owner.json").read_text())
    if (owner.get("root") != str(ROOT) or owner.get("databaseName") != "finance_verify_" + folder.name
            or not within_local(owner["env"]["DATABASE_PATH"]).is_relative_to(folder)):
        raise RuntimeError("Verification scope ownership is invalid.")
    return owner


def pg_env(scope=None):
    dev.pg_owned()
    env = dev.environment()
    if scope:
        owner = verification_owner(scope)
        env.update(owner["env"])
        env["PGDATABASE"] = owner["databaseName"]
    url = urlparse(env["DATABASE_URL"])
    if (url.hostname != "127.0.0.1" or str(url.port) != env["PGPORT"]
            or url.path != "/" + env["PGDATABASE"] or url.username != env["PGUSER"]):
        raise RuntimeError("Backup requires the project-owned loopback development database.")
    result = env.copy()
    result.update(PGHOST="127.0.0.1", PGPORT=env["PGPORT"], PGUSER=env["PGUSER"],
                  PGDATABASE=env["PGDATABASE"])
    directory = run(["psql", "-X", "-v", "ON_ERROR_STOP=1", "-Atc", "SHOW data_directory"], result).strip()
    if Path(directory).resolve() != dev.PG_DATA.resolve():
        raise RuntimeError("Connected PostgreSQL is not this project's owned instance.")
    return result


def stop_verification_writers(folder):
    verification_owner(folder)
    records = json.loads((folder / "processes.json").read_text())
    for row in records:
        if row["name"] not in ("finance", "api", "worker"):
            continue
        identity = dev.process_identity(row["pid"])
        if identity and (identity != row["identity"] or os.getpgid(row["pid"]) != row["pid"]):
            raise RuntimeError("Refusing to stop a reused/unowned verification process.")
        if identity:
            os.killpg(row["pid"], signal.SIGTERM)
        for _ in range(200):
            if not dev.process_group_active(row["pid"]):
                break
            time.sleep(.1)
        else:
            raise RuntimeError("Verification writer did not stop; refusing to make a backup.")


def verification_port_ready(port):
    # A just-exited owned process group can precede kernel listener release.
    # Only wait; never signal a process discovered from a port number.
    for attempt in range(30):
        try:
            dev.require_free(port)
            return
        except RuntimeError:
            if attempt == 29:
                raise
            time.sleep(.1)


def resume_verification_writers(folder):
    owner = verification_owner(folder)
    env = owner["env"]
    records = json.loads((folder / "processes.json").read_text())
    engine = ROOT / "services/financial-engine"
    for row in records:
        name = row["name"]
        if name not in ("finance", "api", "worker"):
            continue
        state = dev.execute(["ps", "-p", str(row["pid"]), "-o", "stat="], check=False, capture=True).stdout.strip()
        if state and not state.startswith("Z"):
            if dev.process_identity(row["pid"]) != row["identity"]:
                raise RuntimeError("Verification ownership changed during the backup.")
            continue
        if name == "finance":
            port = urlparse(env["FINANCIAL_BRIDGE_URL"]).port
            verification_port_ready(port)
            python = str(engine / (".minimal-venv" if (engine / ".minimal-venv/bin/python").exists() else ".venv") / "bin/python")
            args = [python, "-m", "uvicorn", "api.internal.assistant_app:app", "--host", "127.0.0.1", "--port", str(port), "--workers", "1"]
            cwd = engine
        else:
            args = [str(dev.RUNTIME / "bin/pnpm"), "--filter", "@marketbot/" + name, "start"]
            cwd = ROOT
            if name == "api":
                verification_port_ready(env["API_PORT"])
        descriptor = os.open(folder / (name + ".log"), os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
        with os.fdopen(descriptor, "a") as stream:
            process = subprocess.Popen(args, env=env, cwd=cwd, stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
        row.update(pid=process.pid, identity=dev.process_identity(process.pid))
        private_json(folder / "processes.json", records)
    print("Resumed the retained verification writers; development users and data were not modified.")


def pg_sql(sql, env, log=None):
    return run(["psql", "-X", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-Atc", sql], env, log).strip()


def ident(name):
    return '"' + name.replace('"', '""') + '"'


def pg_inventory(env):
    tables = json.loads(pg_sql("""SELECT coalesce(json_agg(json_build_array(n.nspname,c.relname)
      ORDER BY n.nspname,c.relname),'[]'::json) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE c.relkind='r' AND n.nspname NOT IN ('pg_catalog','information_schema')
      AND n.nspname NOT LIKE 'pg_%'""", env))
    output = {}
    for schema, name in tables:
        qualified = ident(schema) + "." + ident(name)
        row = {"count": int(pg_sql("SELECT count(*) FROM " + qualified, env))}
        columns = json.loads(pg_sql("""SELECT coalesce(json_agg(a.attname),'[]'::json)
          FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
          JOIN pg_type t ON t.oid=a.atttypid WHERE a.attnum>0 AND NOT a.attisdropped
          AND n.nspname='""" + schema.replace("'", "''") + "' AND c.relname='" + name.replace("'", "''")
          + "' AND t.typcategory='N' AND lower(a.attname) IN ('id','sequence','version','revision')", env))
        row["watermarks"] = {column: pg_sql("SELECT max(" + ident(column) + ")::text FROM " + qualified, env) or None
                             for column in sorted(columns)}
        output[schema + "." + name] = row
    return output


def within_local(path):
    path = Path(path)
    if not path.is_absolute():
        path = ROOT / path
    lexical = path.absolute()
    if not lexical.is_relative_to(LOCAL):
        raise RuntimeError("Financial backup source must be inside this project's .local directory.")
    for part in [lexical, *lexical.parents]:
        if part == LOCAL.parent:
            break
        if part.is_symlink():
            raise RuntimeError("Financial backup paths must not contain symlinks.")
    return lexical.resolve()


def sqlite_inventory(connection):
    names = [row[0] for row in connection.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
    output = {}
    for name in names:
        columns = [row[1] for row in connection.execute("PRAGMA table_info(" + ident(name) + ")")]
        row = {"count": connection.execute("SELECT count(*) FROM " + ident(name)).fetchone()[0]}
        watermarks = {}
        for column in columns:
            if column.lower() in ("id", "sequence", "version", "revision"):
                value = connection.execute("SELECT max(" + ident(column) + ") FROM " + ident(name)).fetchone()[0]
                if value is None or isinstance(value, (int, float)):
                    watermarks[column] = value
        row["watermarks"] = watermarks
        output[name] = row
    return output


def sqlite_read(path):
    return sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)


def checksum(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def backup(scope=None):
    env = pg_env(scope)
    folder = LOCAL / "backups" / (datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ-") + secrets.token_hex(4))
    folder.mkdir(parents=True, mode=0o700)
    folder.chmod(0o700)
    # API writes and both financial/event schedulers stop before either snapshot.
    # This helper refuses unrelated/reused PIDs and keeps PostgreSQL running.
    if scope:
        stop_verification_writers(scope)
    else:
        dev.stop(["finance", "api", "worker"])
        for name in ("finance", "api", "worker"):
            if dev.service_record(name):
                raise RuntimeError("Development writers did not stop; no backup was made.")
    dev.require_free(env["API_PORT"])
    dev.require_free(urlparse(env["FINANCIAL_BRIDGE_URL"]).port)
    inventory = pg_inventory(env)
    dump = folder / "assistant-postgres.dump"
    old_umask = os.umask(0o077)
    try:
        run(["pg_dump", "--format=custom", "--no-owner", "--no-acl", "--file", str(dump)], env,
            folder / "operations.log")
    finally:
        os.umask(old_umask)
    dump.chmod(0o600)
    control = within_local(env["DATABASE_PATH"])
    sources = []
    if control.exists():
        with sqlite_read(control) as db:
            exists = db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='assistant_bridge_bindings'").fetchone()
            bindings = db.execute("SELECT DISTINCT workspace_id FROM assistant_bridge_bindings").fetchall() if exists else []
        sources.append((control, "control.sqlite"))
        for (workspace,) in sorted(bindings):
            if not re.fullmatch(r"[0-9a-f]{32}", workspace):
                raise RuntimeError("Control database contains an invalid trusted workspace identifier.")
            path = within_local(control.parent / "assistant-workspaces" / workspace / "workspace.db")
            if not path.is_file():
                raise RuntimeError("A trusted financial workspace is missing; backup is incomplete.")
            sources.append((path, "workspaces/" + workspace + "/workspace.db"))
    sqlite = []
    for source, relative in sources:
        target = folder / relative
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        for parent in target.parents:
            if parent == folder.parent:
                break
            parent.chmod(0o700)
        # sqlite3_backup captures committed WAL data; raw DB/WAL files are never copied.
        with sqlite_read(source) as original, sqlite3.connect(target) as snapshot:
            original.backup(snapshot)
            if snapshot.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise RuntimeError("Financial SQLite snapshot integrity check failed.")
            entry = {"path": relative, "inventory": sqlite_inventory(snapshot)}
            if sqlite_inventory(original) != entry["inventory"]:
                raise RuntimeError("Financial data changed during the consistency window.")
        target.chmod(0o600)
        entry["sha256"] = checksum(target)
        sqlite.append(entry)
    if pg_inventory(env) != inventory:
        raise RuntimeError("Development data changed during the consistency window; backup is incomplete.")
    manifest = {"formatVersion": 1, "projectRoot": str(ROOT),
                "scope": "verification" if scope else "development",
                "createdAt": datetime.now(timezone.utc).isoformat(), "writersStopped": True,
                "postgres": {"path": dump.name, "sha256": checksum(dump), "inventory": inventory},
                "controlPresent": control.exists(), "sqlite": sqlite}
    private_json(folder / "manifest.json", manifest)
    print(json.dumps({"backup": str(folder), "postgresTables": len(inventory),
                      "sqliteDatabases": len(sqlite), "scope": manifest["scope"], "writersStopped": True}))
    return folder


def verify_restore(folder):
    folder = within_local(folder)
    if not folder.is_relative_to((LOCAL / "backups").resolve()) or folder.is_symlink():
        raise RuntimeError("Restore verification accepts only this project's private backup directory.")
    manifest = json.loads((folder / "manifest.json").read_text())
    if manifest.get("formatVersion") != 1 or manifest.get("projectRoot") != str(ROOT):
        raise RuntimeError("Backup ownership manifest is invalid.")
    files = [manifest["postgres"], *manifest["sqlite"]]
    for entry in files:
        path = Path(entry["path"])
        if path.is_absolute() or ".." in path.parts or (folder / path).is_symlink():
            raise RuntimeError("Backup file path is invalid.")
        if checksum(folder / path) != entry["sha256"]:
            raise RuntimeError("Backup checksum mismatch; no data was restored.")
    run_id = secrets.token_hex(8)
    name = "finance_restore_" + run_id
    assert re.fullmatch(r"finance_restore_[0-9a-f]{16}", name)
    restore = LOCAL / "restore" / run_id
    restore.mkdir(parents=True, mode=0o700)
    env = pg_env()
    target_env = dict(env, PGDATABASE=name)
    created, verified = False, False
    try:
        pg_sql("CREATE DATABASE " + ident(name), env, folder / "operations.log")
        created = True
        run(["pg_restore", "--no-owner", "--no-acl", "--exit-on-error", "--dbname", name,
             str(folder / manifest["postgres"]["path"])], target_env, folder / "operations.log")
        if pg_inventory(target_env) != manifest["postgres"]["inventory"]:
            raise RuntimeError("Restored PostgreSQL counts/watermarks differ from the backup.")
        for entry in manifest["sqlite"]:
            target = restore / entry["path"]
            target.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
            with sqlite_read(folder / entry["path"]) as source, sqlite3.connect(target) as restored:
                source.backup(restored)
                if restored.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                    raise RuntimeError("Restored SQLite integrity check failed.")
                if sqlite_inventory(restored) != entry["inventory"]:
                    raise RuntimeError("Restored SQLite counts/watermarks differ from the backup.")
            target.chmod(0o600)
        verified = True
    finally:
        if created:
            pg_sql("DROP DATABASE " + ident(name) + " WITH (FORCE)", env, folder / "operations.log")
        shutil.rmtree(restore)
        result = {"verified": verified, "postgresCountsAndWatermarksMatch": verified,
                  "sqliteCountsAndWatermarksMatch": verified, "disposableTargetsRemoved": True,
                  "developmentDatabaseOverwritten": False,
                  "performedAt": datetime.now(timezone.utc).isoformat()}
        private_json(folder / "restore-verification.json", result)
    print(json.dumps(result))


def main():
    # Match the financial service's SQLite build for WAL snapshot compatibility.
    # A stopped WAL database must never be read with immutable=1 as a workaround.
    env = dev.environment()
    engine = ROOT / "services/financial-engine"
    python = Path(env.get("FINANCE_PYTHON") or engine / (
        ".minimal-venv" if (engine / ".minimal-venv/bin/python").exists() else ".venv") / "bin/python")
    if python.exists() and Path(sys.executable).resolve() != python.resolve():
        os.execv(str(python), [str(python), str(Path(__file__).resolve()), *sys.argv[1:]])
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("backup", "verify", "backup-and-verify"))
    parser.add_argument("--backup", type=Path)
    parser.add_argument("--retained-verify", type=Path,
                        help="Explicitly back up a retained project verification DB/workspaces instead of development")
    parser.add_argument("--resume", action="store_true", help="Resume retained verification writers after the operation")
    args = parser.parse_args()
    if args.action == "verify":
        if not args.backup:
            parser.error("verify requires --backup .local/backups/<snapshot>")
        verify_restore(args.backup)
    else:
        scope = within_local(args.retained_verify) if args.retained_verify else None
        if args.resume and not scope:
            parser.error("--resume requires --retained-verify; use finance-dev.sh start for development")
        try:
            folder = backup(scope)
            if args.action == "backup-and-verify":
                verify_restore(folder)
        finally:
            if scope and args.resume:
                resume_verification_writers(scope)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, ValueError, sqlite3.Error) as error:
        raise SystemExit(str(error)) from None
