#!/usr/bin/env python3
"""Run the project-owned development stack without touching existing services."""

from __future__ import annotations

import argparse
import json
import os
import re
import secrets
import shlex
import shutil
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / ".local"
RUNTIME = LOCAL / "runtime"
ENV_FILE = LOCAL / "dev.env"
PG_DATA = LOCAL / "postgres"
PG_MARKER = PG_DATA / "financial-assistant-dev.json"
ENGINE = ROOT / "services" / "financial-engine"
SERVICES = ("finance", "api", "worker", "web")


def execute(args, *, env=None, cwd=ROOT, check=True, capture=False):
    return subprocess.run(args, cwd=cwd, env=env, check=check, text=True, capture_output=capture)


def supported_node(path):
    try:
        version = execute([str(path), "--version"], capture=True).stdout.strip().lstrip("v")
        major, minor, patch = (int(part) for part in version.split(".")[:3])
        return major == 24 or major >= 26 or (major == 22 and (minor, patch) >= (22, 2))
    except (OSError, ValueError, subprocess.CalledProcessError):
        return False


def prepare():
    for path in (LOCAL, RUNTIME / "bin", RUNTIME / "corepack", LOCAL / "logs", LOCAL / "pids"):
        path.mkdir(parents=True, exist_ok=True)
    LOCAL.chmod(0o700)
    node = RUNTIME / "bin" / "node"
    if not node.exists():
        candidates = [
            os.getenv("FINANCE_NODE_BINARY"),
            str(Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"),
            shutil.which("node"),
        ]
        candidate = next((Path(value) for value in candidates if value and supported_node(value)), None)
        if candidate is None:
            raise RuntimeError("Install Node 24 or set FINANCE_NODE_BINARY to Node 22.22.2+, 24.x or 26+.")
        node.symlink_to(candidate.resolve())
    if not supported_node(node):
        raise RuntimeError("The project-local Node does not meet the pinned upstream requirements.")
    corepack = RUNTIME / "bin" / "corepack"
    if not corepack.exists():
        found = shutil.which("corepack")
        if not found:
            raise RuntimeError("Corepack is required to install the pinned pnpm 9.15.0.")
        corepack.symlink_to(Path(found).resolve())
    pnpm = RUNTIME / "bin" / "pnpm"
    pnpm.write_text(
        '#!/usr/bin/env bash\nset -euo pipefail\n'
        'runtime="$(cd "$(dirname "$0")/.." && pwd)"\n'
        'export COREPACK_HOME="$runtime/corepack" COREPACK_ENABLE_DOWNLOAD_PROMPT=0\n'
        'export PATH="$runtime/bin:$PATH"\n'
        'exec "$runtime/bin/node" "$runtime/bin/corepack" pnpm@9.15.0 "$@"\n'
    )
    pnpm.chmod(0o755)
    if not ENV_FILE.exists():
        password = secrets.token_hex(24)
        values = {
            "NODE_ENV": "development",
            "PGPORT": "55433",
            "PGUSER": "financial_assistant_dev",
            "PGDATABASE": "financial_assistant_dev",
            "PGPASSWORD": password,
            "DATABASE_URL": f"postgres://financial_assistant_dev:{password}@127.0.0.1:55433/financial_assistant_dev",
            "BETTER_AUTH_SECRET": secrets.token_hex(32),
            "ENCRYPTION_KEY": secrets.token_hex(32),
            "SCREEN_PROXY_SECRET": secrets.token_hex(32),
            "API_HOST": "127.0.0.1",
            "API_PORT": "3111",
            "API_URL": "http://127.0.0.1:3111",
            "WEB_PORT": "5181",
            "WEB_ORIGIN": "http://127.0.0.1:5181",
            "BETTER_AUTH_URL": "http://127.0.0.1:5181",
            "API_PROXY_TARGET": "http://127.0.0.1:3111",
            "DATA_DIR": str(LOCAL / "assistant-data"),
            "SANDBOX_PROVIDER": "none",
            "CLOUD_AGENT_PROVIDER": "none",
            "AGENT_RUNTIME": "scripted",
            "WAKEUP_DRIVER": "graphile",
            "FINANCIAL_BRIDGE_URL": "http://127.0.0.1:8111",
            "FINANCIAL_BRIDGE_TOKEN": secrets.token_hex(32),
            "FINANCIAL_BRIDGE_ISSUER": "financial-assistant-local",
            "FINANCE_API_PORT": "8111",
            "FINANCE_ASGI_APP": "api.internal.assistant_app:app",
            "DATABASE_PATH": str(LOCAL / "financial-engine" / "stock_analysis.db"),
            "LOG_DIR": str(LOCAL / "financial-engine" / "logs"),
            "SCHEDULE_ENABLED": "false",
            "AGENT_EVENT_MONITOR_ENABLED": "false",
            "STOCK_INDEX_REMOTE_UPDATE_ENABLED": "false",
            "ASSISTANT_RESEARCH_ENABLED": "false",
            "FINANCIAL_SIMULATION_ENABLED": "false",
            "FINANCIAL_CN_SIMULATION_ENABLED": "false",
            "LOG_LEVEL": "info",
        }
        descriptor = os.open(ENV_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w") as stream:
            stream.write("# Project-local disposable development configuration. Never commit.\n")
            stream.writelines(f"{key}={json.dumps(value)}\n" for key, value in values.items())
    print("Prepared project-local runtime and development configuration.")


def environment():
    if not ENV_FILE.exists():
        raise RuntimeError("Run scripts/finance-dev.sh prepare first.")
    values = {}
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, separator, value = line.partition("=")
        if not separator or not re.fullmatch(r"[A-Z][A-Z0-9_]*", key):
            raise RuntimeError("Invalid project-local environment file.")
        values[key] = json.loads(value) if value.startswith('"') else value
    env = os.environ.copy()
    env.update(values)
    env["PATH"] = str(RUNTIME / "bin") + os.pathsep + env.get("PATH", "")
    env["COREPACK_HOME"] = str(RUNTIME / "corepack")
    env["COREPACK_ENABLE_DOWNLOAD_PROMPT"] = "0"
    # AI-Stock honors ENV_FILE directly, including configuration reloads.
    env["ENV_FILE"] = str(ENV_FILE)
    env["PYTHONNOUSERSITE"] = "1"
    return env


def require_free(port):
    with socket.socket() as probe:
        # Match server bind semantics: closed sockets in TIME_WAIT are not listeners.
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            probe.bind(("127.0.0.1", int(port)))
        except OSError as error:
            raise RuntimeError(f"Port {port} is in use; update .local/dev.env to an unused port.") from error


def pg_owned():
    if not PG_MARKER.exists() or json.loads(PG_MARKER.read_text()).get("root") != str(ROOT):
        raise RuntimeError("Refusing to manage a PostgreSQL directory without this project's ownership marker.")


def db_start():
    env = environment()
    if not PG_DATA.exists():
        require_free(env["PGPORT"])
        password_file = LOCAL / "postgres-password.tmp"
        descriptor = os.open(password_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w") as stream:
            stream.write(env["PGPASSWORD"])
        try:
            execute([
                "initdb", "-D", str(PG_DATA), "--encoding=UTF8", "--locale=C",
                "--auth-local=trust", "--auth-host=scram-sha-256", "--username", env["PGUSER"],
                "--pwfile", str(password_file),
            ])
        finally:
            password_file.unlink(missing_ok=True)
        PG_MARKER.write_text(json.dumps({"root": str(ROOT)}))
    pg_owned()
    status = execute(["pg_ctl", "-D", str(PG_DATA), "status"], check=False, capture=True)
    if status.returncode != 0:
        require_free(env["PGPORT"])
        socket_dir = LOCAL / "postgres-socket"
        socket_dir.mkdir(exist_ok=True)
        execute([
            "pg_ctl", "-D", str(PG_DATA), "-l", str(LOCAL / "logs" / "postgres.log"),
            "-o", f"-h 127.0.0.1 -p {int(env['PGPORT'])} -k {shlex.quote(str(socket_dir))}", "start", "-w",
        ])
    probe = execute([
        "psql", "-h", "127.0.0.1", "-p", env["PGPORT"], "-U", env["PGUSER"], "-d", "postgres",
        "-tAc", "SELECT 1 FROM pg_database WHERE datname = '" + env["PGDATABASE"].replace("'", "''") + "'",
    ], env=env, capture=True)
    if probe.stdout.strip() != "1":
        execute(["createdb", "-h", "127.0.0.1", "-p", env["PGPORT"], "-U", env["PGUSER"], env["PGDATABASE"]], env=env)
    print("Project-owned PostgreSQL is ready.")


def db_stop():
    if PG_DATA.exists():
        pg_owned()
        if execute(["pg_ctl", "-D", str(PG_DATA), "status"], check=False, capture=True).returncode == 0:
            execute(["pg_ctl", "-D", str(PG_DATA), "stop", "-m", "fast", "-w"])


def process_identity(pid):
    result = execute(["ps", "-p", str(pid), "-o", "lstart="], check=False, capture=True)
    return result.stdout.strip() if result.returncode == 0 else ""


def process_group_active(group):
    rows = execute(["ps", "-axo", "pgid=,stat="], check=False, capture=True).stdout.splitlines()
    return any(len(parts := row.split()) == 2 and parts[0] == str(group) and not parts[1].startswith("Z")
               for row in rows)


def service_record(name):
    path = LOCAL / "pids" / f"{name}.json"
    if not path.exists():
        return None
    record = json.loads(path.read_text())
    if record.get("root") != str(ROOT):
        raise RuntimeError("Refusing to manage a process owned by a different project.")
    return record if process_identity(record["pid"]) == record["identity"] else None


def start(names):
    env = environment()
    financial_python = env.get("FINANCE_PYTHON") or str(
        ENGINE / (".minimal-venv" if (ENGINE / ".minimal-venv" / "bin" / "python").exists() else ".venv") / "bin" / "python"
    )
    commands = {
        "api": ([str(RUNTIME / "bin" / "pnpm"), "--filter", "@marketbot/api", "start"], ROOT, env["API_PORT"]),
        "worker": ([str(RUNTIME / "bin" / "pnpm"), "--filter", "@marketbot/worker", "start"], ROOT, None),
        "web": ([str(RUNTIME / "bin" / "pnpm"), "--filter", "@marketbot/web", "dev"], ROOT, env["WEB_PORT"]),
        "finance": ([financial_python, "-m", "uvicorn", env.get("FINANCE_ASGI_APP", "api.internal.assistant_app:app"), "--host", "127.0.0.1", "--port", env["FINANCE_API_PORT"], "--workers", "1"], ENGINE, env["FINANCE_API_PORT"]),
    }
    for name in names:
        if service_record(name):
            print(f"{name}: already running")
            continue
        args, cwd, port = commands[name]
        if port:
            require_free(port)
        Path(env["DATABASE_PATH"]).parent.mkdir(parents=True, exist_ok=True)
        Path(env["LOG_DIR"]).mkdir(parents=True, exist_ok=True)
        if name == "finance":
            database_path = Path(env["DATABASE_PATH"])
            if not database_path.is_absolute() or not database_path.resolve().is_relative_to(LOCAL.resolve()):
                raise RuntimeError("Development financial data must remain inside this project's .local directory.")
            if any(path.is_symlink() for path in [database_path, *database_path.parents] if path != LOCAL.parent):
                raise RuntimeError("Development financial database path contains a symlink.")
            # Explicit startup provisioning creates an empty control-plane schema.
            # GET endpoints and first-user ownership are unaffected.
            provision = execute([financial_python, "-c", "from src.storage import DatabaseManager; DatabaseManager.get_instance()"],
                                cwd=ENGINE, env=env, check=False, capture=True)
            if provision.returncode:
                raise RuntimeError("Financial control schema provisioning failed; no service was started.")
            database_path.chmod(0o600)
        with (LOCAL / "logs" / f"{name}.log").open("a") as log:
            process = subprocess.Popen(args, cwd=cwd, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        identity = process_identity(process.pid)
        if not identity:
            raise RuntimeError(f"{name} exited during launch; inspect .local/logs/{name}.log.")
        path = LOCAL / "pids" / f"{name}.json"
        path.write_text(json.dumps({"root": str(ROOT), "pid": process.pid, "identity": identity}))
        path.chmod(0o600)
        print(f"{name}: started (PID {process.pid})")


def stop(names):
    for name in reversed(names):
        record = service_record(name)
        if record:
            if os.getpgid(record["pid"]) != record["pid"]:
                raise RuntimeError(f"Refusing to stop {name}: unexpected process group.")
            os.killpg(record["pid"], signal.SIGTERM)
            for _ in range(200):
                if not process_group_active(record["pid"]):
                    break
                time.sleep(0.1)
            else:
                raise RuntimeError(f"{name} did not stop; ownership record retained for a safe retry.")
            print(f"{name}: stop requested")
        (LOCAL / "pids" / f"{name}.json").unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["prepare", "install", "install-minimal", "db-start", "db-stop", "migrate", "start", "stop", "status", "run"])
    parser.add_argument("arguments", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    names = args.arguments or list(SERVICES)
    if args.action in {"start", "stop"} and any(name not in SERVICES for name in names):
        parser.error("Service names: finance api worker web")
    if args.action == "prepare":
        prepare()
    elif args.action == "install":
        prepare()
        env = environment()
        execute([str(RUNTIME / "bin" / "pnpm"), "install", "--frozen-lockfile"], env=env)
        if not (ENGINE / ".venv" / "bin" / "python").exists():
            execute(["uv", "venv", "--python", "3.11", str(ENGINE / ".venv")])
        execute(["uv", "--no-config", "pip", "install", "--default-index", "https://pypi.org/simple", "--python", str(ENGINE / ".venv" / "bin" / "python"), "-r", str(ENGINE / "requirements.txt"), "pytest", "pytest-timeout", "pytest-split", "flake8"])
    elif args.action == "install-minimal":
        prepare()
        env = environment()
        execute([str(RUNTIME / "bin" / "pnpm"), "install", "--frozen-lockfile"], env=env)
        bundled_python = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
        python_binary = os.getenv("FINANCE_PYTHON_BINARY") or (str(bundled_python) if bundled_python.exists() else "3.11")
        minimal_python = ENGINE / ".minimal-venv" / "bin" / "python"
        if not minimal_python.exists():
            execute(["uv", "venv", "--python", python_binary, *(["--system-site-packages"] if bundled_python.exists() and python_binary == str(bundled_python) else []), str(ENGINE / ".minimal-venv")])
        execute([str(minimal_python), "-m", "ensurepip"], env=env)
        execute([str(minimal_python), "-m", "pip", "--isolated", "install", "--index-url", "https://pypi.org/simple", "--disable-pip-version-check", "-r", str(ROOT / "integrations/financial-engine/requirements-minimal.txt")], env=env)
    elif args.action == "db-start":
        db_start()
    elif args.action == "db-stop":
        db_stop()
    elif args.action == "migrate":
        env = environment()
        execute([str(RUNTIME / "bin" / "pnpm"), "db:generate"], env=env)
        execute([str(RUNTIME / "bin" / "pnpm"), "db:migrate"], env=env)
    elif args.action == "start":
        start(names)
    elif args.action == "stop":
        stop(names)
    elif args.action == "status":
        for name in SERVICES:
            record = service_record(name)
            print(f"{name}: {'running' if record else 'stopped'}")
        if PG_DATA.exists():
            pg_owned()
            status = execute(["pg_ctl", "-D", str(PG_DATA), "status"], check=False, capture=True)
            print(f"postgres: {'running' if status.returncode == 0 else 'stopped'}")
    elif args.action == "run":
        command = args.arguments[1:] if args.arguments[:1] == ["--"] else args.arguments
        if not command:
            parser.error("run requires a command")
        execute(command, env=environment())


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
