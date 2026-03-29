import importlib
import sys


def test_marketbot_agent_import_is_lazy(monkeypatch) -> None:
    sys.modules.pop("marketbot.agent", None)
    sys.modules.pop("marketbot.agent.loop", None)
    sys.modules.pop("marketbot.providers.litellm_provider", None)

    module = importlib.import_module("marketbot.agent")

    assert module.__name__ == "marketbot.agent"
    assert "marketbot.agent.loop" not in sys.modules
    assert "marketbot.providers.litellm_provider" not in sys.modules


def test_marketbot_agent_lazy_getattr_loads_contextbuilder() -> None:
    sys.modules.pop("marketbot.agent", None)

    module = importlib.import_module("marketbot.agent")
    context_builder = module.ContextBuilder

    assert context_builder.__name__ == "ContextBuilder"
