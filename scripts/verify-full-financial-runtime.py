#!/usr/bin/env python3
"""Import full financial SDKs in a credential-free, network-fenced subprocess."""
from __future__ import annotations

import argparse
import importlib
import importlib.metadata
import json
import os
import secrets
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "services/financial-engine"
MODULES = (
    "dotenv", "tenacity", "sqlalchemy", "schedule", "exchange_calendars", "efinance", "akshare",
    "tushare", "pytdx", "baostock", "yfinance", "longbridge.openapi", "tickflow", "futu", "lark_oapi",
    "pandas", "pypinyin", "openpyxl", "numpy", "json_repair", "orjson", "litellm", "tiktoken", "openai",
    "yaml", "jsonschema", "tavily", "serpapi", "requests", "markdown2", "imgkit", "fake_useragent",
    "httpx", "dingtalk_stream", "discord", "nacl", "newspaper", "lxml_html_clean", "jinja2", "fastapi",
    "uvicorn", "multipart", "src.analyzer", "src.agent.llm_adapter", "src.services.task_queue",
    "src.services.screening_service", "src.search_service", "api.app",
)


def audit_child(output: Path):
    sys.path.insert(0, str(ENGINE))
    denied = []

    def deny(*args, **kwargs):
        # Host/address/key values are never recorded. Import must not become a provider call.
        denied.append("network_transport")
        raise RuntimeError("Network is disabled for the SDK import audit")

    socket.create_connection = deny
    socket.socket.connect = deny
    socket.socket.connect_ex = deny
    facts = []
    for name in MODULES:
        start = time.monotonic()
        try:
            importlib.import_module(name)
            facts.append({"module": name, "imported": True, "seconds": round(time.monotonic() - start, 3)})
        except Exception as error:
            # Exception strings can contain config/path/provider internals; retain only type.
            facts.append({"module": name, "imported": False, "errorType": type(error).__name__})
    from src.services.assistant_research import research_capabilities
    capability = research_capabilities()
    result = {
        "python": sys.version.split()[0], "modules": facts, "networkAttemptsBlocked": len(denied),
        "researchEnabled": capability["enabled"], "researchReason": capability["reason"],
        "lifespanStarted": False, "modelCalls": 0, "liveTradingCalls": 0,
        "versions": dict(sorted((distribution.metadata['Name'], distribution.version)
                                 for distribution in importlib.metadata.distributions())),
    }
    result["passed"] = all(fact["imported"] for fact in facts) and not capability["enabled"]
    output.write_text(json.dumps(result, indent=2))
    output.chmod(0o600)
    return 0 if result["passed"] else 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--child", type=Path)
    args = parser.parse_args()
    if args.child:
        return audit_child(args.child)
    interpreter = ENGINE / ".venv/bin/python"
    if not interpreter.is_file():
        raise RuntimeError("Install the full project .venv first")
    audit = ROOT / ".local/full-runtime-audit" / secrets.token_hex(8)
    audit.mkdir(mode=0o700, parents=True)
    empty_env = audit / "import.env"
    empty_env.write_text("# Intentionally empty: no existing .env or model credentials.\n")
    empty_env.chmod(0o600)
    # Construct an allowlist, do not inherit any API keys, provider configs, proxies or credentials.
    env = {key: os.environ[key] for key in ("PATH", "HOME", "USER", "LANG", "LC_ALL", "TMPDIR") if key in os.environ}
    env.update({
        "PYTHONNOUSERSITE": "1", "ENV_FILE": str(empty_env),
        "DATABASE_PATH": str(audit / "control.db"), "LOG_DIR": str(audit / "logs"),
        "SCHEDULE_ENABLED": "false", "AGENT_EVENT_MONITOR_ENABLED": "false",
        "STOCK_INDEX_REMOTE_UPDATE_ENABLED": "false", "ASSISTANT_RESEARCH_ENABLED": "false",
        "FINANCIAL_SIMULATION_ENABLED": "false", "FINANCIAL_CN_SIMULATION_ENABLED": "false",
        "LITELLM_LOCAL_MODEL_COST_MAP": "true", "LITELLM_LOG": "ERROR",
        "HF_HUB_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1", "TOKENIZERS_PARALLELISM": "false",
    })
    result = audit / "result.json"
    log = audit / "imports.log"
    with log.open("w") as stream:
        log.chmod(0o600)
        completed = subprocess.run([str(interpreter), str(Path(__file__).resolve()), "--child", str(result)],
                                   cwd=ENGINE, env=env, stdout=stream, stderr=subprocess.STDOUT, timeout=180)
    if not result.is_file():
        raise RuntimeError(f"Import audit did not finish; inspect private log {log}")
    facts = json.loads(result.read_text())
    print(json.dumps({"passed": facts["passed"], "moduleCount": len(facts["modules"]),
                      "failedModules": [fact['module'] for fact in facts['modules'] if not fact['imported']],
                      "researchEnabled": facts["researchEnabled"], "proof": str(result)}))
    return completed.returncode


if __name__ == "__main__":
    sys.exit(main())
