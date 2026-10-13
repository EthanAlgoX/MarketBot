#!/usr/bin/env python3
"""Verify intelligence against a disposable project-owned PostgreSQL database."""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import secrets
import subprocess
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1]

# The suite follows business boundaries, not the current Git diff. A package
# namespace change touches unrelated tests and must not expand this command.
FINANCIAL_TEST_MARKERS = ("finance", "research", "intelligence", "feed-source")
FINANCIAL_SHARED_REGRESSIONS = (
    "apps/api/src/router.test.ts", "apps/api/src/env.test.ts",
    "apps/api/src/actor-from-membership.test.ts", "apps/api/src/auth-origins.test.ts",
    "apps/api/src/health.test.ts", "packages/contracts/src/auth.test.ts",
    "packages/contracts/src/index.test.ts", "packages/db/src/sessions.test.ts",
    "packages/db/src/space-membership.postgres.test.ts", "apps/mobile/lib/api.test.ts",
    "apps/mobile/lib/session.test.ts", "apps/mobile/lib/auth-routing.test.ts",
    "apps/mobile/lib/notification-open.test.ts", "apps/web/src/lib/session-gate.test.ts",
    "packages/adapters/src/expo-push.test.ts",
)


def full_finance_test_files():
    financial_tests = {
        str(path.relative_to(ROOT))
        for directory in (ROOT / "apps", ROOT / "packages")
        for suffix in ("*.test.ts", "*.test.tsx")
        for path in directory.glob("*/src/**/" + suffix)
        if any(marker in str(path.relative_to(ROOT)).lower() for marker in FINANCIAL_TEST_MARKERS)
    }
    # Expo keeps its reusable native boundaries in lib rather than src.
    financial_tests.update(
        str(path.relative_to(ROOT))
        for suffix in ("*.test.ts", "*.test.tsx")
        for path in (ROOT / "apps/mobile/lib").rglob(suffix)
        if any(marker in str(path.relative_to(ROOT)).lower() for marker in FINANCIAL_TEST_MARKERS)
    )
    return sorted(financial_tests | set(FINANCIAL_SHARED_REGRESSIONS))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--full-finance", action="store_true", help="All changed financial tests plus affected shared identity/API regression")
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location("finance_dev", ROOT / "scripts/finance-dev.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.pg_owned()
    env = module.environment()
    env["PGHOST"] = "127.0.0.1"
    actual = subprocess.check_output(["psql", "-d", "postgres", "-tAc", "SHOW data_directory"], env=env, text=True).strip()
    if Path(actual).resolve() != module.PG_DATA.resolve():
        raise RuntimeError("PostgreSQL does not belong to this project")
    name = "finance_intelligence_" + secrets.token_hex(8)
    proof = ROOT / ".local" / "intelligence-audit" / name
    proof.mkdir(mode=0o700, parents=True)
    parsed = urlsplit(env["DATABASE_URL"])
    env["DATABASE_URL"] = urlunsplit(parsed._replace(path="/" + name))
    env["REALTIME_DATABASE_URL"] = env["DATABASE_URL"]
    env["PGDATABASE"] = name
    env["VERIFY_DATABASE"] = "1"
    pnpm = str(ROOT / ".local/runtime/bin/pnpm")
    test_files = [
        "packages/adapters/src/intelligence-preview.test.ts", "packages/adapters/src/intelligence-service.test.ts",
        "apps/api/src/intelligence-preview.test.ts", "packages/core/src/intelligence-events.test.ts",
        "packages/core/src/intelligence-match.test.ts", "packages/contracts/src/intelligence.test.ts",
    ]
    if args.full_finance:
        test_files = full_finance_test_files()
    commands = [
        [pnpm, "--filter", "@marketbot/db", "migrate"],
        [pnpm, "exec", "vitest", "run", "--reporter=default", "--reporter=json",
         "--outputFile=" + str(proof / "tests.json"), *test_files],
    ]
    created = False
    outcome = {"database": name, "isolated": True, "mode": "full_finance" if args.full_finance else "intelligence", "testFiles": test_files, "checks": [], "cleaned": False}
    try:
        subprocess.run(["createdb", name], env=env, check=True, capture_output=True)
        created = True
        for index, command in enumerate(commands):
            log = proof / f"step-{index + 1}.log"
            with log.open("w") as stream:
                log.chmod(0o600)
                result = subprocess.run(command, cwd=ROOT, env=env, stdout=stream, stderr=subprocess.STDOUT)
            outcome["checks"].append({"command": command[1:], "passed": result.returncode == 0})
            if result.returncode:
                raise RuntimeError(f"Verification failed; inspect private log {log}")
        outcome["passed"] = True
        statistics = json.loads((proof / "tests.json").read_text())
        outcome["statistics"] = {key: statistics[key] for key in
            ("numTotalTests", "numPassedTests", "numFailedTests", "numPendingTests")}
        outcome["statistics"]["files"] = len(statistics["testResults"])
    finally:
        if created:
            subprocess.run(["dropdb", name], env=env, check=True, capture_output=True)
        outcome["cleaned"] = True
        result_path = proof / "result.json"
        result_path.write_text(json.dumps(outcome, indent=2))
        result_path.chmod(0o600)
    print(json.dumps({"passed": outcome.get("passed", False), "cleaned": True, "statistics": outcome.get("statistics"), "proof": str(result_path)}))


if __name__ == "__main__":
    main()
