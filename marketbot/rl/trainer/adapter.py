"""Trainer adapters for exporting MarketBot datasets into trainable formats."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from marketbot.rl.dataset import iter_jsonl, write_jsonl


@dataclass(slots=True)
class TrainingRunSummary:
    """Summary returned by a training adapter execution."""

    adapter: str
    input_path: str
    output_dir: str
    example_count: int
    artifact_path: str
    manifest_path: str
    dry_run: bool = True
    script_path: str | None = None

    def to_dict(self) -> dict[str, Any]:
        payload = {
            "adapter": self.adapter,
            "inputPath": self.input_path,
            "outputDir": self.output_dir,
            "exampleCount": self.example_count,
            "artifactPath": self.artifact_path,
            "manifestPath": self.manifest_path,
            "dryRun": self.dry_run,
        }
        if self.script_path:
            payload["scriptPath"] = self.script_path
        return payload


class TrainerAdapter(Protocol):
    """Protocol for training backends used by MarketBot RL."""

    name: str

    def train(self, dataset_path: Path, output_dir: Path, *, dry_run: bool = True) -> TrainingRunSummary: ...


class JsonlSupervisedTrainerAdapter:
    """Export dataset records as a JSONL supervised training corpus."""

    name = "jsonl-supervised"

    def train(self, dataset_path: Path, output_dir: Path, *, dry_run: bool = True) -> TrainingRunSummary:
        records = list(iter_jsonl(dataset_path))
        examples: list[dict[str, Any]] = []
        for record in records:
            example = self._record_to_example(record)
            if example is not None:
                examples.append(example)
        output_dir.mkdir(parents=True, exist_ok=True)
        artifact_path = write_jsonl(output_dir / "train.jsonl", examples)
        manifest_path = output_dir / "manifest.json"
        manifest = {
            "adapter": self.name,
            "inputPath": str(dataset_path),
            "outputDir": str(output_dir),
            "exampleCount": len(examples),
            "dryRun": dry_run,
            "sourceTypes": sorted({str(item.get("source_type", "unknown")) for item in examples}),
        }
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        return TrainingRunSummary(
            adapter=self.name,
            input_path=str(dataset_path),
            output_dir=str(output_dir),
            example_count=len(examples),
            artifact_path=str(artifact_path),
            manifest_path=str(manifest_path),
            dry_run=dry_run,
        )

    def _record_to_example(self, record: dict[str, Any]) -> dict[str, Any] | None:
        if not isinstance(record, dict):
            return None
        if "label" in record:
            return self._signal_record_to_example(record)
        if "trajectory" in record and "reward" in record:
            return self._episode_record_to_example(record)
        return None

    @staticmethod
    def _signal_record_to_example(record: dict[str, Any]) -> dict[str, Any]:
        label = record.get("label") if isinstance(record.get("label"), dict) else {}
        target = {
            "action": label.get("action"),
            "position_pct": label.get("position_pct"),
            "stop_loss_pct": label.get("stop_loss_pct"),
            "confidence": label.get("confidence"),
            "score": label.get("score"),
        }
        return {
            "id": record.get("id"),
            "source_type": "signal",
            "messages": [
                {"role": "system", "content": "You are a market decision policy. Output only JSON."},
                {"role": "user", "content": str(record.get("prompt", "")).strip()},
            ],
            "completion": json.dumps(target, ensure_ascii=False, sort_keys=True),
            "metadata": {
                "task": record.get("task"),
                "features": record.get("features"),
                "source_metadata": record.get("metadata"),
            },
        }

    @staticmethod
    def _episode_record_to_example(record: dict[str, Any]) -> dict[str, Any]:
        trajectory = record.get("trajectory") if isinstance(record.get("trajectory"), dict) else {}
        signal = trajectory.get("signal") if isinstance(trajectory.get("signal"), dict) else {}
        reward = record.get("reward") if isinstance(record.get("reward"), dict) else {}
        task = record.get("task") if isinstance(record.get("task"), dict) else {}
        task_context = {
            "symbol": task.get("symbol"),
            "prices": task.get("prices"),
            "requested_steps": task.get("requested_steps"),
        }
        target = {
            "action": signal.get("action"),
            "position_pct": signal.get("position_pct"),
            "confidence": signal.get("confidence"),
            "score": signal.get("score"),
            "episode_reward": reward.get("score"),
        }
        return {
            "id": record.get("id"),
            "source_type": "episode",
            "messages": [
                {"role": "system", "content": "You are a market policy optimizer. Output only JSON."},
                {
                    "role": "user",
                    "content": (
                        f"{str(record.get('prompt', '')).strip()}\n"
                        f"Task context: {json.dumps(task_context, ensure_ascii=False)}"
                    ),
                },
            ],
            "completion": json.dumps(target, ensure_ascii=False, sort_keys=True),
            "metadata": {
                "task": task,
                "reward": reward,
                "trajectory": trajectory,
                "source_metadata": record.get("metadata"),
            },
        }


def get_trainer_adapter(name: str) -> TrainerAdapter:
    """Resolve a trainer adapter by name."""
    normalized = str(name or "").strip().lower()
    if normalized == JsonlSupervisedTrainerAdapter.name:
        return JsonlSupervisedTrainerAdapter()
    if normalized == SlimeJsonlTrainerAdapter.name:
        return SlimeJsonlTrainerAdapter()
    raise ValueError(f"unknown trainer adapter: {name}")


class SlimeJsonlTrainerAdapter:
    """Export records in the JSONL prompt format used by Slime/OpenClaw-RL."""

    name = "slime-jsonl"
    DEFAULT_GENERATE_PATH = "marketbot.rl.slime_generate.generate"
    DEFAULT_REWARD_KEY = "score"
    DEFAULT_INPUT_KEY = "task"

    def train(self, dataset_path: Path, output_dir: Path, *, dry_run: bool = True) -> TrainingRunSummary:
        records = list(iter_jsonl(dataset_path))
        prompts: list[dict[str, Any]] = []
        for record in records:
            prompt = self._record_to_prompt(record)
            if prompt is not None:
                prompts.append({"task": prompt})
        output_dir.mkdir(parents=True, exist_ok=True)
        artifact_path = write_jsonl(output_dir / "train.jsonl", prompts)
        manifest_path = output_dir / "manifest.json"
        manifest = {
            "adapter": self.name,
            "inputPath": str(dataset_path),
            "outputDir": str(output_dir),
            "exampleCount": len(prompts),
            "dryRun": dry_run,
            "inputKey": self.DEFAULT_INPUT_KEY,
            "rewardKey": self.DEFAULT_REWARD_KEY,
            "recommendedArgs": {
                "prompt_data": str(artifact_path),
                "input_key": self.DEFAULT_INPUT_KEY,
                "reward_key": self.DEFAULT_REWARD_KEY,
                "custom_generate_function_path": self.DEFAULT_GENERATE_PATH,
            },
            "notes": [
                "Matches the JSONL wrapper style used by OpenClaw-RL terminal-rl convert_task_to_dataset.py",
                "Requires a compatible MarketBot rollout environment and custom generate function to train end-to-end",
            ],
        }
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        return TrainingRunSummary(
            adapter=self.name,
            input_path=str(dataset_path),
            output_dir=str(output_dir),
            example_count=len(prompts),
            artifact_path=str(artifact_path),
            manifest_path=str(manifest_path),
            dry_run=dry_run,
        )

    def _record_to_prompt(self, record: dict[str, Any]) -> dict[str, Any] | None:
        if not isinstance(record, dict):
            return None
        if "label" in record:
            return self._signal_record_to_prompt(record)
        if "trajectory" in record and "reward" in record:
            return self._episode_record_to_prompt(record)
        return None

    @staticmethod
    def _signal_record_to_prompt(record: dict[str, Any]) -> dict[str, Any]:
        task = record.get("task") if isinstance(record.get("task"), dict) else {}
        features = record.get("features") if isinstance(record.get("features"), dict) else {}
        label = record.get("label") if isinstance(record.get("label"), dict) else {}
        metadata = record.get("metadata") if isinstance(record.get("metadata"), dict) else {}
        symbol = str(task.get("symbol") or features.get("symbol") or "UNKNOWN").upper()
        synthetic_prices = SlimeJsonlTrainerAdapter._signal_prices(features)
        return {
            "task_name": f"market_signal::{symbol}",
            "task_path": "",
            "instruction": str(record.get("prompt", "")).strip(),
            "data_source": "marketbot_market_signal",
            "symbol": symbol,
            "task_type": "signal",
            "prices": synthetic_prices,
            "features": features,
            "target_action": label.get("action"),
            "target_position_pct": label.get("position_pct"),
            "target_stop_loss_pct": label.get("stop_loss_pct"),
            "score": float(label.get("score", 0.0) or 0.0),
            "metadata": metadata,
        }

    @staticmethod
    def _episode_record_to_prompt(record: dict[str, Any]) -> dict[str, Any]:
        task = record.get("task") if isinstance(record.get("task"), dict) else {}
        trajectory = record.get("trajectory") if isinstance(record.get("trajectory"), dict) else {}
        signal = trajectory.get("signal") if isinstance(trajectory.get("signal"), dict) else {}
        reward = record.get("reward") if isinstance(record.get("reward"), dict) else {}
        metadata = record.get("metadata") if isinstance(record.get("metadata"), dict) else {}
        symbol = str(task.get("symbol") or "UNKNOWN").upper()
        return {
            "task_name": f"market_episode::{symbol}",
            "task_path": "",
            "instruction": str(record.get("prompt", "")).strip(),
            "data_source": "marketbot_market_episode",
            "symbol": symbol,
            "task_type": "episode",
            "prices": task.get("prices", []),
            "requested_steps": task.get("requested_steps"),
            "signal": signal,
            "reward": reward,
            "score": float(reward.get("score", 0.0) or 0.0),
            "metadata": metadata,
        }

    @staticmethod
    def _signal_prices(features: dict[str, Any]) -> list[float]:
        price_change_pct = float(features.get("price_change_pct", 0.0) or 0.0)
        base = 100.0
        next_price = round(base * (1.0 + (price_change_pct / 100.0)), 6)
        follow_price = round(next_price * (1.0 + (price_change_pct / 200.0)), 6)
        return [base, next_price, follow_price]

    def emit_script_template(self, summary: TrainingRunSummary, output_path: Path) -> Path:
        """Write a Slime launch script template for the exported dataset."""
        script = f"""#!/usr/bin/env bash
set -euo pipefail

# Update these paths for your environment before running.
export HF_CKPT="${{HF_CKPT:-/path/to/model}}"
export REF_LOAD="${{REF_LOAD:-/path/to/reference_model}}"
export SAVE_CKPT="${{SAVE_CKPT:-/path/to/save/checkpoints}}"
export WANDB_KEY="${{WANDB_KEY:-your-wandb-key}}"
export ROLLOUT_PROMPT_DATA="{summary.artifact_path}"

# Optional for MarketBot-style env integration.
export ENV_SERVER_URL="${{ENV_SERVER_URL:-http://127.0.0.1:18080}}"

# Example Slime/OpenClaw-RL invocation shape.
python train_rl.py \\
  --prompt-data "${{ROLLOUT_PROMPT_DATA}}" \\
  --input-key "{self.DEFAULT_INPUT_KEY}" \\
  --reward-key "{self.DEFAULT_REWARD_KEY}" \\
  --custom-generate-function-path "{self.DEFAULT_GENERATE_PATH}"
"""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(script, encoding="utf-8")
        try:
            output_path.chmod(0o755)
        except OSError:
            pass
        return output_path
