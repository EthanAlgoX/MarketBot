from types import SimpleNamespace

from marketbot.providers.custom_provider import CustomProvider


def _response_with_tool_calls(tool_calls):
    return SimpleNamespace(
        choices=[
            SimpleNamespace(
                finish_reason="tool_calls",
                message=SimpleNamespace(
                    content=None,
                    tool_calls=tool_calls,
                    reasoning_content=None,
                ),
            )
        ],
        usage=SimpleNamespace(prompt_tokens=10, completion_tokens=5, total_tokens=15),
    )


def test_custom_provider_parse_skips_malformed_tool_calls() -> None:
    provider = CustomProvider(api_key="test", api_base="http://localhost:8000/v1", default_model="test-model")
    response = _response_with_tool_calls(
        [
            SimpleNamespace(id="bad_1", function=None),
            SimpleNamespace(id="bad_2", function=SimpleNamespace(name="", arguments="{}")),
            SimpleNamespace(
                id="ok_1",
                function=SimpleNamespace(
                    name="market_social_sentiment",
                    arguments='{"symbols":["NVDA"],"limit":10}',
                ),
            ),
        ]
    )

    result = provider._parse(response)

    assert result.finish_reason == "tool_calls"
    assert len(result.tool_calls) == 1
    assert result.tool_calls[0].id == "ok_1"
    assert result.tool_calls[0].name == "market_social_sentiment"
    assert result.tool_calls[0].arguments == {"symbols": ["NVDA"], "limit": 10}


def test_custom_provider_parse_treats_missing_arguments_as_empty_dict() -> None:
    provider = CustomProvider(api_key="test", api_base="http://localhost:8000/v1", default_model="test-model")
    response = _response_with_tool_calls(
        [
            SimpleNamespace(
                id="ok_2",
                function=SimpleNamespace(name="browser_site", arguments=None),
            )
        ]
    )

    result = provider._parse(response)

    assert len(result.tool_calls) == 1
    assert result.tool_calls[0].arguments == {}
