from pathlib import Path
from types import SimpleNamespace

from marketbot.cli.openclaw_runtime import run_openclaw_launch


class _Console:
    def __init__(self) -> None:
        self.lines: list[str] = []

    def print(self, text="", end="\n") -> None:
        self.lines.append(str(text))

    def print_json(self, data=None) -> None:
        self.lines.append(str(data))


def test_run_openclaw_launch_dry_run_prints_plan(tmp_path) -> None:
    console = _Console()
    dataset = tmp_path / "market_signal_dataset.jsonl"
    dataset.write_text("{}", encoding="utf-8")
    config = SimpleNamespace(workspace_path=tmp_path)

    class _Summary:
        bundle_dir = str(tmp_path / "openclaw_bundle")
        script_path = str(tmp_path / "openclaw_bundle" / "run_openclaw_train.sh")
        remote_script_path = str(tmp_path / "openclaw_bundle" / "run_openclaw_remote_env.sh")
        env_script_path = str(tmp_path / "openclaw_bundle" / "run_marketbot_env.sh")

        def to_dict(self):
            return {"bundle_dir": self.bundle_dir}

    run_openclaw_launch(
        commands_file=tmp_path / "marketbot" / "cli" / "commands.py",
        config=config,
        dataset_path=dataset,
        output_dir=tmp_path / "openclaw_export",
        openclaw_root=None,
        remote_env=True,
        env_wait_s=15.0,
        dry_run=True,
        json_output=False,
        console=console,
        detect_openclaw_root=lambda _root: tmp_path / "OpenClaw-RL",
        export_openclaw_bundle=lambda *_args, **_kwargs: _Summary(),
        resolve_openclaw_report_paths=lambda _index: {
            "summaryMarkdown": tmp_path / "reports" / "summary.md",
            "summaryCsv": tmp_path / "reports" / "summary.csv",
        },
        wait_for_http_health=lambda *_args, **_kwargs: True,
        tail_text=lambda _path: "",
        classify_openclaw_launch_error=lambda *_args, **_kwargs: {},
        build_openclaw_run_report=lambda _path: {},
        append_openclaw_runs_index=lambda _payload: tmp_path / "runs_index.jsonl",
        write_openclaw_runs_archive=lambda _path, completed_at: {},
    )

    assert any("OpenClaw Launch Plan" in line for line in console.lines)
    assert any("run_openclaw_remote_env.sh" in line for line in console.lines)
    assert any("Dry-run only" in line for line in console.lines)
