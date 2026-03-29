from marketbot.agent.processor_messages import build_messages, get_last_skill_routing, get_recent_history
from marketbot.session.manager import Session


def test_get_recent_history_uses_processor_windows() -> None:
    session = Session(key="cli:test")
    for i in range(5):
        session.add_message("user", f"u{i}")
        session.add_message("assistant", f"a{i}")

    class _Processor:
        memory_window = 4
        history_turn_window = 2

    history = get_recent_history(_Processor(), session)

    assert [item["content"] for item in history] == ["u3", "a3", "u4", "a4"]


def test_build_messages_records_last_skill_routing() -> None:
    session = Session(key="cli:test")

    class _Context:
        @staticmethod
        def build_messages(**kwargs):
            return [{"role": "system", "content": "prompt"}, {"role": "user", "content": kwargs["current_message"]}]

        @staticmethod
        def get_last_skill_routing():
            return {"selected": [{"name": "market-report"}]}

    class _Processor:
        context = _Context()
        memory_window = 4
        history_turn_window = 2

        @staticmethod
        def rewrite_sensitive_market_shortcuts(message: str) -> str:
            return f"rewritten:{message}"

        @staticmethod
        def get_recent_history(session):
            return [{"role": "user", "content": "old"}]

    messages = build_messages(_Processor(), session=session, current_message="hello")

    assert messages[-1]["content"] == "rewritten:hello"
    assert session.metadata["last_skill_routing"]["selected"][0]["name"] == "market-report"


def test_get_last_skill_routing_delegates_to_context() -> None:
    class _Context:
        @staticmethod
        def get_last_skill_routing():
            return {"selected": [{"name": "market-report"}]}

    class _Processor:
        context = _Context()

    assert get_last_skill_routing(_Processor()) == {"selected": [{"name": "market-report"}]}
