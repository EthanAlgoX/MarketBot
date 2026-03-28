"""Shared RL/OpenClaw CLI execution helpers."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any, Callable

import typer


def run_rl_evaluate(
    *,
    symbol: str,
    prices: str,
    task_file: Path | None,
    task_key: str,
    action: str,
    position_pct: float,
    steps: int,
    drawdown_coef: float,
    turnover_coef: float,
    slippage_bps: float,
    json_output: bool,
    console: Any,
    parse_float_csv: Callable[[str | None], list[float]],
    local_market_env_factory: Callable[..., Any],
) -> None:
    """Evaluate a single offline market episode with the local RL environment."""
    if task_file is not None:
        task_payload = json.loads(task_file.read_text(encoding="utf-8"))
        resolved_key = str(task_payload.get("task_key") or task_key)
        task_meta = dict(task_payload)
        task_meta.pop("task_key", None)
    else:
        clean_symbol = symbol.strip().upper()
        parsed_prices = parse_float_csv(prices)
        if not clean_symbol:
            raise typer.BadParameter("--symbol is required when --task-file is not provided")
        if len(parsed_prices) < 2:
            raise typer.BadParameter("--prices must contain at least two values")
        resolved_key = task_key
        task_meta = {
            "symbol": clean_symbol,
            "prices": parsed_prices,
            "instruction": f"Trade {clean_symbol} for offline evaluation.",
            "drawdown_coef": drawdown_coef,
            "turnover_coef": turnover_coef,
            "slippage_bps": slippage_bps,
        }

    env = local_market_env_factory(task_catalog={resolved_key: task_meta})
    lease = asyncio.run(env.allocate(resolved_key, request_id="cli"))
    lease_id = str(lease["lease_id"])
    asyncio.run(env.reset(lease_id, task_meta=task_meta, run_ctx={"uid": "cli"}))
    if action.strip().lower() != "watch" or position_pct > 0:
        asyncio.run(
            env.exec_tool(
                lease_id,
                "submit_trade_action",
                {"action": action.strip().lower(), "position_pct": position_pct},
            )
        )
    advance_steps = steps if steps > 0 else max(len(task_meta.get("prices", [])) - 1, 1)
    asyncio.run(env.exec_tool(lease_id, "advance_time", {"steps": advance_steps}))
    details = env.evaluate_details(lease_id)
    asyncio.run(env.close(lease_id))

    if json_output:
        console.print_json(json.dumps(details, ensure_ascii=False))
        return

    reward = details["reward"]
    console.print("[bold]Offline RL Evaluation[/bold]")
    console.print(f"Task: {details['taskKey']} | Symbol: {details['symbol']}")
    console.print(
        "Reward: "
        f"{reward['score']:.4f} | Return: {reward['realized_return']:.4f} | "
        f"MaxDD: {details['maxDrawdown']:.4f} | Turnover: {details['turnover']:.4f}"
    )


def run_rl_build_dataset(
    *,
    config: Any,
    input_path: Path | None,
    output_path: Path | None,
    dataset_type: str,
    console: Any,
    load_market_signal_rollouts: Callable[[Path], list[Any]],
    detect_rollout_type: Callable[[list[Any]], str],
    build_market_episode_dataset_records: Callable[[list[Any]], list[Any]],
    build_market_signal_dataset_records: Callable[[list[Any]], list[Any]],
    write_jsonl: Callable[[Path, list[Any]], Path],
) -> None:
    """Convert rollout logs into lightweight dataset records."""
    workspace = config.workspace_path
    default_input = workspace / config.tools.market.policy.rollout_log_path
    source = input_path or default_input
    requested_type = dataset_type.strip().lower() or "auto"
    if requested_type not in {"auto", "signal", "episode"}:
        raise typer.BadParameter("--type must be one of: auto, signal, episode")

    events = load_market_signal_rollouts(source)
    if not events:
        raise typer.BadParameter(f"no rollout events found in {source}")
    resolved_type = detect_rollout_type(events) if requested_type == "auto" else requested_type
    if resolved_type == "episode":
        records = build_market_episode_dataset_records(events)
        default_output = workspace / "rl" / "datasets" / "market_episode_dataset.jsonl"
    else:
        records = build_market_signal_dataset_records(events)
        default_output = workspace / "rl" / "datasets" / "market_signal_dataset.jsonl"
    target = output_path or default_output
    if not records:
        raise typer.BadParameter(f"no dataset records could be built from {source}")
    written = write_jsonl(target, records)
    console.print(f"[green]✓[/green] Wrote {len(records)} {resolved_type} records to {written}")


def run_rl_collect(
    *,
    config: Any,
    symbol: str,
    prices: str,
    price_change_pct: float | None,
    news_sentiment: float,
    social_sentiment: float,
    macro_risk: float,
    evidence: str,
    task_key: str,
    steps: int,
    output_path: Path | None,
    json_output: bool,
    console: Any,
    parse_float_csv: Callable[[str | None], list[float]],
    collect_market_signal_episode: Callable[..., dict[str, Any]],
    append_episode_log: Callable[[Path, dict[str, Any]], Path],
) -> None:
    """Collect one offline episode by mapping market_signal into the RL environment."""
    workspace = config.workspace_path
    clean_symbol = symbol.strip().upper()
    parsed_prices = parse_float_csv(prices)
    if len(parsed_prices) < 2:
        raise typer.BadParameter("--prices must contain at least two values")
    evidence_items = [item.strip() for item in evidence.split(";") if item.strip()]
    event = collect_market_signal_episode(
        config=config,
        workspace=workspace,
        symbol=clean_symbol,
        prices=parsed_prices,
        price_change_pct=price_change_pct,
        news_sentiment=news_sentiment,
        social_sentiment=social_sentiment,
        macro_risk=macro_risk,
        evidence=evidence_items,
        task_key=task_key,
        steps=steps,
    )
    target = output_path or (workspace / "rl" / "episodes" / "market_signal_episodes.jsonl")
    written = append_episode_log(target, event)

    if json_output:
        console.print_json(json.dumps(event, ensure_ascii=False))
        return

    evaluation = event["environment"]["evaluation"]
    reward = evaluation["reward"]
    signal = event["signal"]
    console.print("[bold]Collected RL Episode[/bold]")
    console.print(
        f"Signal: {signal['action'].upper()} | Position: {signal['positionPct']:.4f} | "
        f"Confidence: {signal['confidence']:.4f}"
    )
    console.print(
        "Reward: "
        f"{reward['score']:.4f} | Return: {reward['realized_return']:.4f} | "
        f"MaxDD: {evaluation['maxDrawdown']:.4f} | Turnover: {evaluation['turnover']:.4f}"
    )
    console.print(f"[green]✓[/green] Appended episode to {written}")


def run_rl_train(
    *,
    config: Any,
    dataset_path: Path | None,
    adapter_name: str,
    output_dir: Path | None,
    dry_run: bool,
    emit_slime_script: bool,
    json_output: bool,
    console: Any,
    get_trainer_adapter: Callable[[str], Any],
) -> None:
    """Export a dataset into a trainer-ready artifact format."""
    workspace = config.workspace_path
    source = dataset_path or (workspace / "rl" / "datasets" / "market_signal_dataset.jsonl")
    if not source.exists():
        raise typer.BadParameter(f"dataset not found: {source}")
    target_dir = output_dir or (workspace / "rl" / "training" / adapter_name)
    adapter = get_trainer_adapter(adapter_name)
    summary = adapter.train(source, target_dir, dry_run=dry_run)
    if emit_slime_script:
        if not hasattr(adapter, "emit_script_template"):
            raise typer.BadParameter(f"adapter does not support --emit-slime-script: {adapter_name}")
        script_path = target_dir / "run_slime_train.sh"
        written_script = adapter.emit_script_template(summary, script_path)
        summary.script_path = str(written_script)

    if json_output:
        console.print_json(json.dumps(summary.to_dict(), ensure_ascii=False))
        return

    console.print("[bold]RL Train Export[/bold]")
    console.print(f"Adapter: {summary.adapter}")
    console.print(f"Examples: {summary.example_count}")
    console.print(f"Artifacts: {summary.artifact_path}")
    console.print(f"Manifest: {summary.manifest_path}")
    if summary.script_path:
        console.print(f"Script: {summary.script_path}")
    if summary.dry_run:
        console.print("[dim]Dry-run only: no external trainer was invoked.[/dim]")


def run_rl_export_openclaw(
    *,
    commands_file: Path,
    config: Any,
    dataset_path: Path | None,
    output_dir: Path | None,
    openclaw_root: Path | None,
    dry_run: bool,
    json_output: bool,
    console: Any,
    detect_openclaw_root: Callable[[Path], Path | None],
    export_openclaw_bundle: Callable[..., Any],
) -> None:
    """Export a Slime/OpenClaw-compatible bundle with generate shim and launch script."""
    workspace = config.workspace_path
    source = dataset_path or (workspace / "rl" / "datasets" / "market_signal_dataset.jsonl")
    if not source.exists():
        raise typer.BadParameter(f"dataset not found: {source}")
    target_dir = output_dir or (workspace / "rl" / "training" / "openclaw_export")
    marketbot_root = commands_file.resolve().parents[2]
    resolved_openclaw_root = openclaw_root or detect_openclaw_root(marketbot_root)
    summary = export_openclaw_bundle(
        source,
        target_dir,
        marketbot_root=marketbot_root,
        openclaw_root=resolved_openclaw_root,
        dry_run=dry_run,
    )

    if json_output:
        console.print_json(json.dumps(summary.to_dict(), ensure_ascii=False))
        return

    console.print("[bold]OpenClaw Export[/bold]")
    console.print(f"Examples: {summary.adapter_summary.example_count}")
    console.print(f"Artifacts: {summary.adapter_summary.artifact_path}")
    console.print(f"Manifest: {summary.adapter_summary.manifest_path}")
    console.print(f"Generate Shim: {summary.generate_path}")
    console.print(f"Script: {summary.script_path}")
    console.print(f"README: {summary.readme_path}")
    console.print(f"OpenClaw Root: {summary.openclaw_root}")
    console.print(f"OpenClaw Launcher: {summary.terminal_script_path}")
    console.print(f"Env Script: {summary.env_script_path}")
    console.print(f"Remote Script: {summary.remote_script_path}")
    console.print(f"Task Catalog: {summary.task_catalog_path}")
    console.print(f"Env Template: {summary.env_example_path}")
    if summary.adapter_summary.dry_run:
        console.print("[dim]Dry-run only: no external trainer was invoked.[/dim]")
