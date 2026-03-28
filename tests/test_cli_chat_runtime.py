import asyncio
from types import SimpleNamespace

from marketbot.bus.events import OutboundMessage
from marketbot.cli.chat_runtime import run_agent_interactive, run_agent_once


class _Console:
    def __init__(self) -> None:
        self.lines: list[str] = []

    def print(self, text="") -> None:
        self.lines.append(str(text))

    def status(self, *_args, **_kwargs):
        class _Status:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

        return _Status()


def test_run_agent_once_processes_direct_message_and_closes_loop() -> None:
    console = _Console()
    printed: list[tuple[str, bool]] = []

    class _Loop:
        channels_config = None

        async def process_direct(self, message, session_id, on_progress=None):
            assert message == "hello"
            assert session_id == "cli:direct"
            assert on_progress is not None
            await on_progress("tooling", tool_hint=True)
            return "final answer"

        async def close_mcp(self):
            printed.append(("closed", True))

    asyncio.run(
        run_agent_once(
            agent_loop=_Loop(),
            message="hello",
            session_id="cli:direct",
            markdown=True,
            logs=False,
            console=console,
            print_response=lambda response, render_markdown: printed.append((response, render_markdown)),
        )
    )

    assert ("final answer", True) in printed
    assert ("closed", True) in printed
    assert any("↳ tooling" in line for line in console.lines)


def test_run_agent_interactive_routes_input_and_prints_response() -> None:
    console = _Console()
    printed: list[tuple[str, bool]] = []
    restored: list[str] = []
    published = []

    class _Bus:
        def __init__(self) -> None:
            self._outbound: asyncio.Queue[OutboundMessage] = asyncio.Queue()

        async def publish_inbound(self, msg):
            published.append(msg)
            await self._outbound.put(
                OutboundMessage(channel=msg.channel, chat_id=msg.chat_id, content="assistant reply", metadata={})
            )

        async def consume_outbound(self):
            return await self._outbound.get()

    class _Loop:
        channels_config = SimpleNamespace(send_tool_hints=True, send_progress=True)

        def __init__(self) -> None:
            self._stopped = False

        async def run(self):
            while not self._stopped:
                await asyncio.sleep(0.01)

        def stop(self):
            self._stopped = True
            restored.append("stopped")

        async def close_mcp(self):
            restored.append("closed")

    inputs = iter(["hello", "exit"])

    async def _read_input():
        return next(inputs)

    asyncio.run(
        run_agent_interactive(
            bus=_Bus(),
            agent_loop=_Loop(),
            session_id="cli:chat",
            markdown=False,
            logs=True,
            console=console,
            print_response=lambda response, render_markdown: printed.append((response, render_markdown)),
            read_input_async=_read_input,
            flush_pending_tty_input=lambda: None,
            restore_terminal=lambda: restored.append("restored"),
            is_exit_command=lambda command: command == "exit",
        )
    )

    assert len(published) == 1
    assert published[0].channel == "cli"
    assert published[0].chat_id == "chat"
    assert published[0].content == "hello"
    assert printed == [("assistant reply", False)]
    assert restored == ["restored", "stopped", "closed"]
