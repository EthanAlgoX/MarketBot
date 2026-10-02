"""Exported training inputs must preserve explicit exposure limits."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from marketbot.rl.trainer.openclaw_export import detect_openclaw_root, emit_task_catalog


def test_openclaw_default_checkout_path_is_portable(tmp_path):
    assert detect_openclaw_root(tmp_path / "MarketBot") == tmp_path / "OpenClaw-RL"


def test_exported_task_catalog_preserves_zero_position_limit(tmp_path):
    artifact = tmp_path / "train.jsonl"
    artifact.write_text(json.dumps({"task": {"task_name": "zero", "symbol": "SPY", "prices": [100, 105], "target_position_pct": 0}}) + "\n")
    output = emit_task_catalog(tmp_path / "catalog.json", artifact_path=artifact)
    assert json.loads(output.read_text())["zero"]["max_position_pct"] == 0


@pytest.mark.parametrize("position", [True, None, float("nan"), float("inf"), -0.1, 1.1])
def test_invalid_task_position_limit_cannot_replace_existing_catalog(tmp_path, position):
    artifact = tmp_path / "train.jsonl"
    artifact.write_text(json.dumps({"task": {"symbol": "SPY", "prices": [100, 105], "target_position_pct": position}}) + "\n")
    output = tmp_path / "catalog.json"
    output.write_bytes(b"preserve existing catalog")
    with pytest.raises(ValueError, match="position limit"):
        emit_task_catalog(output, artifact_path=artifact)
    assert output.read_bytes() == b"preserve existing catalog"


@pytest.mark.parametrize("price", [True, 0, -1, float("nan"), float("inf")])
def test_invalid_task_prices_cannot_replace_existing_catalog(tmp_path, price):
    artifact = tmp_path / "train.jsonl"
    artifact.write_text(json.dumps({"task": {"symbol": "SPY", "prices": [100, price]}}) + "\n")
    output = tmp_path / "catalog.json"
    output.write_bytes(b"preserve existing catalog")
    with pytest.raises(ValueError, match="prices"):
        emit_task_catalog(output, artifact_path=artifact)
    assert output.read_bytes() == b"preserve existing catalog"


def test_twitter_wrapper_uses_selected_interpreter_source_and_literal_arguments(tmp_path):
    source = tmp_path / "twitter source"
    package = source / "twitter_cli"
    package.mkdir(parents=True)
    (package / "__init__.py").write_text("")
    (package / "cli.py").write_text("import json, sys\nprint(json.dumps(sys.argv[1:]))\n")
    wrapper = Path(__file__).resolve().parents[1] / "scripts" / "twitter-cli-wrapper"
    query = "NVDA earnings; literal $HOME"
    env = {**os.environ, "MARKETBOT_TWITTER_PYTHON": sys.executable, "MARKETBOT_TWITTER_CLI_ROOT": str(source)}
    result = subprocess.run(["bash", str(wrapper), "search", query, "--json"], env=env, text=True, capture_output=True, check=True)
    assert json.loads(result.stdout) == ["search", query, "--json"]
