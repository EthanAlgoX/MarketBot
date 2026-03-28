from pathlib import Path
from types import SimpleNamespace

import pytest
import typer

from marketbot.cli.rl_runtime import run_rl_build_dataset, run_rl_evaluate


class _Console:
    def __init__(self) -> None:
        self.lines: list[str] = []

    def print(self, text="") -> None:
        self.lines.append(str(text))

    def print_json(self, data=None) -> None:
        self.lines.append(str(data))


def test_run_rl_evaluate_requires_symbol_without_task_file() -> None:
    with pytest.raises(typer.BadParameter):
        run_rl_evaluate(
            symbol="",
            prices="1,2,3",
            task_file=None,
            task_key="adhoc",
            action="buy",
            position_pct=1.0,
            steps=0,
            drawdown_coef=0.5,
            turnover_coef=0.02,
            slippage_bps=5.0,
            json_output=False,
            console=_Console(),
            parse_float_csv=lambda raw: [float(x) for x in str(raw).split(",") if x],
            local_market_env_factory=lambda **kwargs: None,
        )


def test_run_rl_build_dataset_writes_detected_episode_records(tmp_path) -> None:
    console = _Console()
    config = SimpleNamespace(
        workspace_path=tmp_path,
        tools=SimpleNamespace(
            market=SimpleNamespace(
                policy=SimpleNamespace(rollout_log_path=Path("rollouts.jsonl"))
            )
        ),
    )
    written = []

    def _write_jsonl(path, records):
        written.append((path, records))
        return path

    run_rl_build_dataset(
        config=config,
        input_path=None,
        output_path=None,
        dataset_type="auto",
        console=console,
        load_market_signal_rollouts=lambda _path: [{"kind": "episode"}],
        detect_rollout_type=lambda _events: "episode",
        build_market_episode_dataset_records=lambda _events: [{"id": 1}],
        build_market_signal_dataset_records=lambda _events: [],
        write_jsonl=_write_jsonl,
    )

    expected = tmp_path / "rl" / "datasets" / "market_episode_dataset.jsonl"
    assert written == [(expected, [{"id": 1}])]
    assert any("Wrote 1 episode records" in line for line in console.lines)
