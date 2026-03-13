"""Helpers for exporting MarketBot RL artifacts into an OpenClaw-RL bundle."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from marketbot.rl.dataset import iter_jsonl
from marketbot.rl.trainer.adapter import SlimeJsonlTrainerAdapter, TrainingRunSummary


@dataclass(slots=True)
class OpenClawExportSummary:
    """Summary of an OpenClaw-compatible export bundle."""

    adapter_summary: TrainingRunSummary
    bundle_dir: str
    generate_path: str
    script_path: str
    readme_path: str
    marketbot_root: str
    openclaw_root: str
    terminal_script_path: str
    env_script_path: str
    remote_script_path: str
    task_catalog_path: str
    env_example_path: str
    terminal_env_example_path: str
    env_local_example_path: str
    terminal_env_local_example_path: str

    def to_dict(self) -> dict[str, Any]:
        payload = self.adapter_summary.to_dict()
        payload.update(
            {
                "bundleDir": self.bundle_dir,
                "generatePath": self.generate_path,
                "scriptPath": self.script_path,
                "readmePath": self.readme_path,
                "marketbotRoot": self.marketbot_root,
                "openclawRoot": self.openclaw_root,
                "terminalScriptPath": self.terminal_script_path,
                "envScriptPath": self.env_script_path,
                "remoteScriptPath": self.remote_script_path,
                "taskCatalogPath": self.task_catalog_path,
                "envExamplePath": self.env_example_path,
                "terminalEnvExamplePath": self.terminal_env_example_path,
                "envLocalExamplePath": self.env_local_example_path,
                "terminalEnvLocalExamplePath": self.terminal_env_local_example_path,
            }
        )
        return payload


def detect_openclaw_root(marketbot_root: Path) -> Path:
    """Infer a nearby OpenClaw-RL checkout from the local workspace layout."""
    sibling = marketbot_root.parent / "OpenClaw-RL"
    if sibling.exists():
        return sibling
    return Path("/Users/yunxuanhan/Documents/workspace/ai/OpenClaw-RL")


def export_openclaw_bundle(
    dataset_path: Path,
    output_dir: Path,
    *,
    marketbot_root: Path,
    openclaw_root: Path,
    dry_run: bool = True,
) -> OpenClawExportSummary:
    """Export a Slime/OpenClaw-compatible bundle with helper scripts."""
    adapter = SlimeJsonlTrainerAdapter()
    summary = adapter.train(dataset_path, output_dir, dry_run=dry_run)
    bundle_dir = Path(summary.output_dir)
    generate_path = emit_generate_shim(bundle_dir / "generate.py", marketbot_root=marketbot_root)
    task_catalog_path = emit_task_catalog(
        bundle_dir / "task_catalog.json",
        artifact_path=Path(summary.artifact_path),
    )
    env_example_path = emit_env_example(
        bundle_dir / "env.example",
        artifact_path=Path(summary.artifact_path),
        marketbot_root=marketbot_root,
        openclaw_root=openclaw_root,
        task_catalog_path=task_catalog_path,
    )
    terminal_env_example_path = emit_terminal_env_example(
        bundle_dir / "terminal_qwen3_8b.env.example",
        openclaw_root=openclaw_root,
    )
    env_local_example_path = emit_env_local_example(bundle_dir / "env.local.example")
    terminal_env_local_example_path = emit_terminal_env_local_example(
        bundle_dir / "terminal_qwen3_8b.env.local.example"
    )
    env_script_path = emit_marketbot_env_script(
        bundle_dir / "run_marketbot_env.sh",
        marketbot_root=marketbot_root,
        task_catalog_path=task_catalog_path,
        terminal_env_example_path=terminal_env_example_path,
        env_local_example_path=env_local_example_path,
        terminal_env_local_example_path=terminal_env_local_example_path,
    )
    script_path = emit_openclaw_script(
        bundle_dir / "run_openclaw_train.sh",
        artifact_path=Path(summary.artifact_path),
        marketbot_root=marketbot_root,
        openclaw_root=openclaw_root,
        terminal_env_example_path=terminal_env_example_path,
        env_local_example_path=env_local_example_path,
        terminal_env_local_example_path=terminal_env_local_example_path,
    )
    remote_script_path = emit_openclaw_remote_script(
        bundle_dir / "run_openclaw_remote_env.sh",
        artifact_path=Path(summary.artifact_path),
        marketbot_root=marketbot_root,
        openclaw_root=openclaw_root,
        terminal_env_example_path=terminal_env_example_path,
        env_local_example_path=env_local_example_path,
        terminal_env_local_example_path=terminal_env_local_example_path,
    )
    readme_path = emit_openclaw_readme(
        bundle_dir / "README_OPENCLAW.md",
        artifact_path=Path(summary.artifact_path),
        manifest_path=Path(summary.manifest_path),
        task_catalog_path=task_catalog_path,
        env_script_path=env_script_path,
        script_path=script_path,
        remote_script_path=remote_script_path,
        env_example_path=env_example_path,
        terminal_env_example_path=terminal_env_example_path,
        env_local_example_path=env_local_example_path,
        terminal_env_local_example_path=terminal_env_local_example_path,
        generate_path=generate_path,
        marketbot_root=marketbot_root,
        openclaw_root=openclaw_root,
    )
    return OpenClawExportSummary(
        adapter_summary=summary,
        bundle_dir=str(bundle_dir),
        generate_path=str(generate_path),
        script_path=str(script_path),
        readme_path=str(readme_path),
        marketbot_root=str(marketbot_root),
        openclaw_root=str(openclaw_root),
        terminal_script_path=str(openclaw_root / "terminal-rl" / "terminal_qwen3_8b_rl.sh"),
        env_script_path=str(env_script_path),
        remote_script_path=str(remote_script_path),
        task_catalog_path=str(task_catalog_path),
        env_example_path=str(env_example_path),
        terminal_env_example_path=str(terminal_env_example_path),
        env_local_example_path=str(env_local_example_path),
        terminal_env_local_example_path=str(terminal_env_local_example_path),
    )


def emit_generate_shim(output_path: Path, *, marketbot_root: Path) -> Path:
    """Write a local generate.py shim that forwards into MarketBot."""
    script = f'''"""OpenClaw-RL generate shim for MarketBot local rollouts."""

from __future__ import annotations

import os
import sys
from pathlib import Path

MARKETBOT_ROOT = os.getenv("MARKETBOT_ROOT", {str(marketbot_root)!r})
resolved_root = str(Path(MARKETBOT_ROOT).expanduser())
if resolved_root not in sys.path:
    sys.path.insert(0, resolved_root)

from marketbot.rl.slime_generate import generate

__all__ = ["generate"]
'''
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(script, encoding="utf-8")
    return output_path


def emit_openclaw_script(
    output_path: Path,
    *,
    artifact_path: Path,
    marketbot_root: Path,
    openclaw_root: Path,
    terminal_env_example_path: Path,
    env_local_example_path: Path,
    terminal_env_local_example_path: Path,
) -> Path:
    """Write a wrapper that launches the terminal-rl OpenClaw script with MarketBot data."""
    script = f"""#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${{BASH_SOURCE[0]}}")" && pwd)"
ENV_FILE="${{ENV_FILE:-${{SCRIPT_DIR}}/env.example}}"
if [[ -f "${{ENV_FILE}}" ]]; then
  set -a
  source "${{ENV_FILE}}"
  set +a
fi
ENV_LOCAL_FILE="${{ENV_LOCAL_FILE:-{env_local_example_path.with_name('env.local')}}}"
if [[ -f "${{ENV_LOCAL_FILE}}" ]]; then
  set -a
  source "${{ENV_LOCAL_FILE}}"
  set +a
fi
TERMINAL_ENV_FILE="${{TERMINAL_ENV_FILE:-{terminal_env_example_path}}}"
if [[ -f "${{TERMINAL_ENV_FILE}}" ]]; then
  set -a
  source "${{TERMINAL_ENV_FILE}}"
  set +a
fi
TERMINAL_ENV_LOCAL_FILE="${{TERMINAL_ENV_LOCAL_FILE:-{terminal_env_local_example_path.with_name('terminal_qwen3_8b.env.local')}}}"
if [[ -f "${{TERMINAL_ENV_LOCAL_FILE}}" ]]; then
  set -a
  source "${{TERMINAL_ENV_LOCAL_FILE}}"
  set +a
fi

export OPENCLAW_ROOT="${{OPENCLAW_ROOT:-{openclaw_root}}}"
export MARKETBOT_ROOT="${{MARKETBOT_ROOT:-{marketbot_root}}}"
export MARKETBOT_EXPORT_DIR="${{MARKETBOT_EXPORT_DIR:-${{SCRIPT_DIR}}}}"
export PYTHONPATH="${{MARKETBOT_EXPORT_DIR}}:${{MARKETBOT_ROOT}}:${{PYTHONPATH:-}}"
export ROLLOUT_PROMPT_DATA="${{ROLLOUT_PROMPT_DATA:-{artifact_path}}}"
export REPO_ROOT="${{REPO_ROOT:-${{OPENCLAW_ROOT}}}}"

# Update these paths for your environment before running.
export HF_CKPT="${{HF_CKPT:-/path/to/model}}"
export REF_LOAD="${{REF_LOAD:-/path/to/reference_model}}"
export SAVE_CKPT="${{SAVE_CKPT:-/path/to/save/checkpoints}}"
export WANDB_KEY="${{WANDB_KEY:-your-wandb-key}}"

cd "${{OPENCLAW_ROOT}}"
bash terminal-rl/terminal_qwen3_8b_rl.sh
"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(script, encoding="utf-8")
    try:
        output_path.chmod(0o755)
    except OSError:
        pass
    return output_path


def emit_marketbot_env_script_with_catalog(
    output_path: Path,
    *,
    marketbot_root: Path,
    task_catalog_path: Path | None,
    terminal_env_example_path: Path,
    env_local_example_path: Path,
    terminal_env_local_example_path: Path,
) -> Path:
    """Write a helper script that starts the MarketBot HTTP env server."""
    task_catalog_expr = str(task_catalog_path) if task_catalog_path is not None else ""
    script = f"""#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${{BASH_SOURCE[0]}}")" && pwd)"
ENV_FILE="${{ENV_FILE:-${{SCRIPT_DIR}}/env.example}}"
if [[ -f "${{ENV_FILE}}" ]]; then
  set -a
  source "${{ENV_FILE}}"
  set +a
fi
ENV_LOCAL_FILE="${{ENV_LOCAL_FILE:-{env_local_example_path.with_name('env.local')}}}"
if [[ -f "${{ENV_LOCAL_FILE}}" ]]; then
  set -a
  source "${{ENV_LOCAL_FILE}}"
  set +a
fi
TERMINAL_ENV_FILE="${{TERMINAL_ENV_FILE:-{terminal_env_example_path}}}"
if [[ -f "${{TERMINAL_ENV_FILE}}" ]]; then
  set -a
  source "${{TERMINAL_ENV_FILE}}"
  set +a
fi
TERMINAL_ENV_LOCAL_FILE="${{TERMINAL_ENV_LOCAL_FILE:-{terminal_env_local_example_path.with_name('terminal_qwen3_8b.env.local')}}}"
if [[ -f "${{TERMINAL_ENV_LOCAL_FILE}}" ]]; then
  set -a
  source "${{TERMINAL_ENV_LOCAL_FILE}}"
  set +a
fi

export MARKETBOT_ROOT="${{MARKETBOT_ROOT:-{marketbot_root}}}"
export MARKETBOT_ENV_HOST="${{MARKETBOT_ENV_HOST:-127.0.0.1}}"
export MARKETBOT_ENV_PORT="${{MARKETBOT_ENV_PORT:-18080}}"
export TASK_CATALOG_PATH="${{TASK_CATALOG_PATH:-{task_catalog_expr}}}"
export PYTHONPATH="${{MARKETBOT_ROOT}}:${{PYTHONPATH:-}}"
export PYTHON_BIN="${{PYTHON_BIN:-python}}"

cd "${{MARKETBOT_ROOT}}"
"${{PYTHON_BIN}}" -m marketbot.cli.commands rl serve-env \\
  --host "${{MARKETBOT_ENV_HOST}}" \\
  --port "${{MARKETBOT_ENV_PORT}}" \\
  --task-catalog "${{TASK_CATALOG_PATH}}"
"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(script, encoding="utf-8")
    try:
        output_path.chmod(0o755)
    except OSError:
        pass
    return output_path


def emit_marketbot_env_script(
    output_path: Path,
    *,
    marketbot_root: Path,
    task_catalog_path: Path | None,
    terminal_env_example_path: Path,
    env_local_example_path: Path,
    terminal_env_local_example_path: Path,
) -> Path:
    """Write a helper script that starts the MarketBot HTTP env server."""
    return emit_marketbot_env_script_with_catalog(
        output_path,
        marketbot_root=marketbot_root,
        task_catalog_path=task_catalog_path,
        terminal_env_example_path=terminal_env_example_path,
        env_local_example_path=env_local_example_path,
        terminal_env_local_example_path=terminal_env_local_example_path,
    )


def emit_openclaw_remote_script(
    output_path: Path,
    *,
    artifact_path: Path,
    marketbot_root: Path,
    openclaw_root: Path,
    terminal_env_example_path: Path,
    env_local_example_path: Path,
    terminal_env_local_example_path: Path,
) -> Path:
    """Write a wrapper that routes OpenClaw rollouts through the remote MarketBot env server."""
    script = f"""#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${{BASH_SOURCE[0]}}")" && pwd)"
ENV_FILE="${{ENV_FILE:-${{SCRIPT_DIR}}/env.example}}"
if [[ -f "${{ENV_FILE}}" ]]; then
  set -a
  source "${{ENV_FILE}}"
  set +a
fi
ENV_LOCAL_FILE="${{ENV_LOCAL_FILE:-{env_local_example_path.with_name('env.local')}}}"
if [[ -f "${{ENV_LOCAL_FILE}}" ]]; then
  set -a
  source "${{ENV_LOCAL_FILE}}"
  set +a
fi
TERMINAL_ENV_FILE="${{TERMINAL_ENV_FILE:-{terminal_env_example_path}}}"
if [[ -f "${{TERMINAL_ENV_FILE}}" ]]; then
  set -a
  source "${{TERMINAL_ENV_FILE}}"
  set +a
fi
TERMINAL_ENV_LOCAL_FILE="${{TERMINAL_ENV_LOCAL_FILE:-{terminal_env_local_example_path.with_name('terminal_qwen3_8b.env.local')}}}"
if [[ -f "${{TERMINAL_ENV_LOCAL_FILE}}" ]]; then
  set -a
  source "${{TERMINAL_ENV_LOCAL_FILE}}"
  set +a
fi

export OPENCLAW_ROOT="${{OPENCLAW_ROOT:-{openclaw_root}}}"
export MARKETBOT_ROOT="${{MARKETBOT_ROOT:-{marketbot_root}}}"
export MARKETBOT_EXPORT_DIR="${{MARKETBOT_EXPORT_DIR:-${{SCRIPT_DIR}}}}"
export MARKETBOT_ENV_HOST="${{MARKETBOT_ENV_HOST:-127.0.0.1}}"
export MARKETBOT_ENV_PORT="${{MARKETBOT_ENV_PORT:-18080}}"
export ENV_SERVER_URL="${{ENV_SERVER_URL:-http://${{MARKETBOT_ENV_HOST}}:${{MARKETBOT_ENV_PORT}}}}"
export USE_REMOTE_ENV="${{USE_REMOTE_ENV:-1}}"
export START_ENV_POOL_SERVER="${{START_ENV_POOL_SERVER:-0}}"
export PYTHONPATH="${{MARKETBOT_EXPORT_DIR}}:${{MARKETBOT_ROOT}}:${{PYTHONPATH:-}}"
export ROLLOUT_PROMPT_DATA="${{ROLLOUT_PROMPT_DATA:-{artifact_path}}}"
export REPO_ROOT="${{REPO_ROOT:-${{OPENCLAW_ROOT}}}}"

# Update these paths for your environment before running.
export HF_CKPT="${{HF_CKPT:-/path/to/model}}"
export REF_LOAD="${{REF_LOAD:-/path/to/reference_model}}"
export SAVE_CKPT="${{SAVE_CKPT:-/path/to/save/checkpoints}}"
export WANDB_KEY="${{WANDB_KEY:-your-wandb-key}}"

cd "${{OPENCLAW_ROOT}}"
bash terminal-rl/terminal_qwen3_8b_rl.sh
"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(script, encoding="utf-8")
    try:
        output_path.chmod(0o755)
    except OSError:
        pass
    return output_path


def emit_openclaw_readme(
    output_path: Path,
    *,
    artifact_path: Path,
    manifest_path: Path,
    task_catalog_path: Path,
    env_script_path: Path,
    script_path: Path,
    remote_script_path: Path,
    env_example_path: Path,
    terminal_env_example_path: Path,
    env_local_example_path: Path,
    terminal_env_local_example_path: Path,
    generate_path: Path,
    marketbot_root: Path,
    openclaw_root: Path,
) -> Path:
    """Write a short handoff guide for running the exported bundle in OpenClaw-RL."""
    content = f"""# MarketBot OpenClaw Export

This directory packages MarketBot RL data for an OpenClaw-RL or Slime training run.

## Files

- `train.jsonl`: Slime/OpenClaw prompt dataset (`input_key=task`, `reward_key=score`)
- `manifest.json`: export metadata and recommended args
- `generate.py`: shim that forwards `generate.generate` into `marketbot.rl.slime_generate.generate`
- `task_catalog.json`: preloaded task registry for the MarketBot env server
- `env.example`: one place to fill `HF_CKPT`, `REF_LOAD`, `SAVE_CKPT`, `WANDB_KEY`, and env server values
- `env.local.example`: optional local-only overrides that map to `env.local`
- `terminal_qwen3_8b.env.example`: machine-specific overrides for GPU split, router, worker URLs, and tmp dirs
- `terminal_qwen3_8b.env.local.example`: optional local-only overrides that map to `terminal_qwen3_8b.env.local`
- `run_marketbot_env.sh`: starts the MarketBot HTTP env server
- `run_openclaw_train.sh`: wrapper that runs OpenClaw against local in-process MarketBot env
- `run_openclaw_remote_env.sh`: wrapper that runs OpenClaw against a remote `ENV_SERVER_URL`

## Usage: Local In-Process Env

1. Edit `{env_example_path.name}` and fill at least `HF_CKPT`, `REF_LOAD`, `SAVE_CKPT`, and `WANDB_KEY`.
2. If you want machine-private overrides, use `{env_local_example_path.name}` and `{terminal_env_local_example_path.name}` as references for `env.local` and `terminal_qwen3_8b.env.local`.
3. If needed, adjust `{terminal_env_example_path.name}` for your machine layout.
4. Run the wrapper from this export directory:

```bash
cd "{output_path.parent}"
bash {script_path.name}
```

The wrapper defaults `OPENCLAW_ROOT` to `{openclaw_root}` and then delegates to `terminal-rl/terminal_qwen3_8b_rl.sh`, which already matches the needed `--prompt-data`, `--input-key task`, `--reward-key score`, and `--custom-generate-function-path generate.generate` settings.

The script auto-loads `{env_example_path.name}`, then `env.local`, then `{terminal_env_example_path.name}`, then `terminal_qwen3_8b.env.local` when present, and adds both this export directory and `MARKETBOT_ROOT` to `PYTHONPATH`, so OpenClaw-RL can import `generate.generate` from `{generate_path.name}` without copying files into its repo.

## Usage: Remote Env Server

1. Edit `{env_example_path.name}` once.
2. If you want machine-private overrides, use `{env_local_example_path.name}` and `{terminal_env_local_example_path.name}` as references for `env.local` and `terminal_qwen3_8b.env.local`.
3. If needed, adjust `{terminal_env_example_path.name}` for your machine.
4. In terminal A:

```bash
cd "{output_path.parent}"
bash {env_script_path.name}
```

5. In terminal B:

```bash
cd "{output_path.parent}"
bash {remote_script_path.name}
```

The remote wrapper exports `ENV_SERVER_URL`, `USE_REMOTE_ENV=1`, and `START_ENV_POOL_SERVER=0` before calling the same OpenClaw terminal script, so `marketbot.rl.slime_generate.generate` will route rollout steps through the HTTP env server. The env server script preloads `{task_catalog_path.name}` and still leaves dynamic task allocation available as a fallback.

## Artifact Paths

- Dataset: `{artifact_path}`
- Manifest: `{manifest_path}`
- Task catalog: `{task_catalog_path}`
- Env template: `{env_example_path}`
- Env local example: `{env_local_example_path}`
- Terminal env template: `{terminal_env_example_path}`
- Terminal env local example: `{terminal_env_local_example_path}`
- OpenClaw launcher: `{openclaw_root / "terminal-rl" / "terminal_qwen3_8b_rl.sh"}`
"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")
    return output_path


def emit_task_catalog(output_path: Path, *, artifact_path: Path) -> Path:
    """Build a task catalog from the exported Slime/OpenClaw prompt dataset."""
    catalog: dict[str, dict[str, Any]] = {}
    for index, record in enumerate(iter_jsonl(artifact_path)):
        task = record.get("task") if isinstance(record.get("task"), dict) else {}
        task_name = str(task.get("task_name") or f"marketbot_task_{index}")
        symbol = str(task.get("symbol") or "UNKNOWN").upper()
        prices = [float(item) for item in task.get("prices", []) if item is not None]
        if len(prices) < 2:
            prices = [1.0, 1.0]
        catalog[task_name] = {
            "symbol": symbol,
            "prices": prices,
            "instruction": str(task.get("instruction") or f"Trade {symbol} over the provided episode."),
            "objective": str(task.get("objective") or "maximize episode reward"),
            "max_position_pct": float(task.get("target_position_pct", 1.0) or 1.0),
        }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    return output_path


def emit_env_example(
    output_path: Path,
    *,
    artifact_path: Path,
    marketbot_root: Path,
    openclaw_root: Path,
    task_catalog_path: Path,
) -> Path:
    """Write an environment variable template for the exported bundle."""
    content = f"""# OpenClaw-RL bundle paths
export OPENCLAW_ROOT="{openclaw_root}"
export MARKETBOT_ROOT="{marketbot_root}"
export MARKETBOT_EXPORT_DIR="$(cd "$(dirname "${{BASH_SOURCE[0]}}")" && pwd)"
export REPO_ROOT="${{OPENCLAW_ROOT}}"

# Training artifacts
export ROLLOUT_PROMPT_DATA="{artifact_path}"
export TASK_CATALOG_PATH="{task_catalog_path}"

# Fill these before training
export HF_CKPT="/path/to/model"
export REF_LOAD="/path/to/reference_model"
export SAVE_CKPT="/path/to/save/checkpoints"
export WANDB_KEY="your-wandb-key"

# Remote env server settings
export MARKETBOT_ENV_HOST="127.0.0.1"
export MARKETBOT_ENV_PORT="18080"
export ENV_SERVER_URL="http://${{MARKETBOT_ENV_HOST}}:${{MARKETBOT_ENV_PORT}}"
export USE_REMOTE_ENV="1"
export START_ENV_POOL_SERVER="0"
"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")
    return output_path


def emit_env_local_example(output_path: Path) -> Path:
    """Write a local-only override template for env.local."""
    content = """# Optional local-only overrides. Rename or copy values into env.local.
# Examples:
# export HF_CKPT="/mnt/models/qwen3-8b"
# export REF_LOAD="/mnt/models/qwen3-8b-ref"
# export SAVE_CKPT="/mnt/checkpoints/marketbot-terminal-rl"
# export WANDB_KEY="..."
# export MARKETBOT_ENV_HOST="10.0.0.5"
# export MARKETBOT_ENV_PORT="18080"
"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")
    return output_path


def emit_terminal_env_example(output_path: Path, *, openclaw_root: Path) -> Path:
    """Write machine-specific overrides for the OpenClaw terminal training script."""
    content = f"""# Optional machine-specific overrides for terminal_qwen3_8b_rl.sh
# This file is sourced after env.example.

export NUM_GPUS="8"
export ACTOR_GPUS="4"
export ROLLOUT_GPUS="4"

export MASTER_ADDR="127.0.0.1"
export PROVIDER_NAME="pull"
export ENV_SERVER_BIND_HOST="0.0.0.0"
export ENV_SERVER_HOST="${{MASTER_ADDR}}"
export ENV_SERVER_PORT="${{MARKETBOT_ENV_PORT:-18080}}"

export ROUTER_CONDA_ENV_PATH=""
export ROUTER_PROJECT_DIR="{openclaw_root}"
export ROUTER_HOST="0.0.0.0"
export ROUTER_PORT="${{ENV_SERVER_PORT}}"
export ROUTER_RESTART="1"
export CHECK_HOST="127.0.0.1"
export CHECK_WAIT_SECS="60"

export WORKER_URLS=""
export RAY_TMPDIR=""
export PYTORCH_CUDA_ALLOC_CONF="max_split_size_mb:2048,expandable_segments:True"
"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")
    return output_path


def emit_terminal_env_local_example(output_path: Path) -> Path:
    """Write a local-only override template for terminal_qwen3_8b.env.local."""
    content = """# Optional local-only overrides. Rename or copy values into terminal_qwen3_8b.env.local.
# Examples:
# export NUM_GPUS="4"
# export ACTOR_GPUS="2"
# export ROLLOUT_GPUS="2"
# export WORKER_URLS="http://127.0.0.1:18081,http://127.0.0.1:18082"
# export ROUTER_CONDA_ENV_PATH="/opt/conda/envs/openclaw"
# export RAY_TMPDIR="/mnt/ray-tmp"
"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")
    return output_path
