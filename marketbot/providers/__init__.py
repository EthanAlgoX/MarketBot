"""LLM provider abstraction module."""

from marketbot.providers.base import LLMProvider, LLMResponse

__all__ = ["LLMProvider", "LLMResponse", "LiteLLMProvider", "OpenAICodexProvider", "AzureOpenAIProvider"]


def __getattr__(name: str):
    """Lazily import concrete providers so base imports stay lightweight."""
    if name == "LiteLLMProvider":
        from marketbot.providers.litellm_provider import LiteLLMProvider

        return LiteLLMProvider
    if name == "OpenAICodexProvider":
        from marketbot.providers.openai_codex_provider import OpenAICodexProvider

        return OpenAICodexProvider
    if name == "AzureOpenAIProvider":
        from marketbot.providers.azure_openai_provider import AzureOpenAIProvider

        return AzureOpenAIProvider
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
