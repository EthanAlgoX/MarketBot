"""Shared CLI chat execution helpers."""

from __future__ import annotations

import asyncio
from contextlib import nullcontext
from typing import Any, Awaitable, Callable

from marketbot.bus.events import InboundMessage


def thinking_context(*, console: Any, logs: bool):
    """Return the appropriate thinking indicator context manager."""
    if logs:
        return nullcontext()
    return console.status("[dim]marketbot is thinking...[/dim]", spinner="dots")


def build_cli_progress_callback(*, console: Any, agent_loop: Any):
    """Build a CLI progress printer honoring channel config toggles."""

    async def _cli_progress(content: str, *, tool_hint: bool = False) -> None:
        ch = agent_loop.channels_config
        if ch and tool_hint and not ch.send_tool_hints:
            return
        if ch and not tool_hint and not ch.send_progress:
            return
        console.print(f"  [dim]↳ {content}[/dim]")

    return _cli_progress


async def run_agent_once(
    *,
    agent_loop: Any,
    message: str,
    session_id: str,
    markdown: bool,
    logs: bool,
    console: Any,
    print_response: Callable[[str, bool], None],
) -> None:
    """Execute a single direct agent request for the CLI."""
    cli_progress = build_cli_progress_callback(console=console, agent_loop=agent_loop)
    with thinking_context(console=console, logs=logs):
        response = await agent_loop.process_direct(message, session_id, on_progress=cli_progress)
    print_response(response, render_markdown=markdown)
    await agent_loop.close_mcp()


async def run_agent_interactive(
    *,
    bus: Any,
    agent_loop: Any,
    session_id: str,
    markdown: bool,
    logs: bool,
    console: Any,
    print_response: Callable[[str, bool], None],
    read_input_async: Callable[[], Awaitable[str]],
    flush_pending_tty_input: Callable[[], None],
    restore_terminal: Callable[[], None],
    is_exit_command: Callable[[str], bool],
) -> None:
    """Run the interactive CLI chat loop using the shared bus path."""
    if ":" in session_id:
        cli_channel, cli_chat_id = session_id.split(":", 1)
    else:
        cli_channel, cli_chat_id = "cli", session_id

    bus_task = asyncio.create_task(agent_loop.run())
    turn_done = asyncio.Event()
    turn_done.set()
    turn_response: list[str] = []

    async def _consume_outbound() -> None:
        while True:
            try:
                msg = await asyncio.wait_for(bus.consume_outbound(), timeout=1.0)
                if msg.metadata.get("_progress"):
                    is_tool_hint = msg.metadata.get("_tool_hint", False)
                    ch = agent_loop.channels_config
                    if ch and is_tool_hint and not ch.send_tool_hints:
                        pass
                    elif ch and not is_tool_hint and not ch.send_progress:
                        pass
                    else:
                        console.print(f"  [dim]↳ {msg.content}[/dim]")
                elif not turn_done.is_set():
                    if msg.content:
                        turn_response.append(msg.content)
                    turn_done.set()
                elif msg.content:
                    console.print()
                    print_response(msg.content, render_markdown=markdown)
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break

    outbound_task = asyncio.create_task(_consume_outbound())

    try:
        while True:
            try:
                flush_pending_tty_input()
                user_input = await read_input_async()
                command = user_input.strip()
                if not command:
                    continue

                if is_exit_command(command):
                    restore_terminal()
                    console.print("\nGoodbye!")
                    break

                turn_done.clear()
                turn_response.clear()

                await bus.publish_inbound(
                    InboundMessage(
                        channel=cli_channel,
                        sender_id="user",
                        chat_id=cli_chat_id,
                        content=user_input,
                    )
                )

                with thinking_context(console=console, logs=logs):
                    await turn_done.wait()

                if turn_response:
                    print_response(turn_response[0], render_markdown=markdown)
            except KeyboardInterrupt:
                restore_terminal()
                console.print("\nGoodbye!")
                break
            except EOFError:
                restore_terminal()
                console.print("\nGoodbye!")
                break
    finally:
        agent_loop.stop()
        outbound_task.cancel()
        await asyncio.gather(bus_task, outbound_task, return_exceptions=True)
        await agent_loop.close_mcp()
