from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

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


def test_custom_provider_parse_raw_response_skips_malformed_tool_calls() -> None:
    provider = CustomProvider(api_key="test", api_base="http://localhost:8000/v1", default_model="test-model")
    response = {
        "choices": [
            {
                "finish_reason": "tool_calls",
                "message": {
                    "content": None,
                    "tool_calls": [
                        {"id": "bad_1", "function": None},
                        {"id": "bad_2", "function": {"arguments": "{}"}},
                        {
                            "id": "ok_3",
                            "function": {
                                "name": "browser_page",
                                "arguments": '{"action":"open","target":"https://twitter.com"}',
                            },
                        },
                    ],
                },
            }
        ],
        "usage": {"prompt_tokens": 9, "completion_tokens": 4, "total_tokens": 13},
    }

    result = provider._parse_raw_response(response)

    assert result.finish_reason == "tool_calls"
    assert len(result.tool_calls) == 1
    assert result.tool_calls[0].id == "ok_3"
    assert result.tool_calls[0].name == "browser_page"
    assert result.tool_calls[0].arguments == {"action": "open", "target": "https://twitter.com"}


def test_custom_provider_parse_raw_response_returns_error_for_missing_choices() -> None:
    provider = CustomProvider(api_key="test", api_base="http://localhost:8000/v1", default_model="test-model")

    result = provider._parse_raw_response({"id": "resp_123", "object": "chat.completion"})

    assert result.finish_reason == "error"
    assert "missing choices" in str(result.content)
    assert "payload keys=id, object" in str(result.content)


def test_custom_provider_parse_raw_response_reports_input_sensitive() -> None:
    provider = CustomProvider(api_key="test", api_base="http://localhost:8000/v1", default_model="test-model")

    result = provider._parse_raw_response(
        {
            "id": "resp_sensitive",
            "choices": [],
            "input_sensitive": True,
            "input_sensitive_type": "security",
        }
    )

    assert result.finish_reason == "error"
    assert "input_sensitive" in str(result.content)
    assert "security" in str(result.content)


def test_custom_provider_parse_raw_response_reports_input_sensitive_when_flag_field_exists_without_choices() -> None:
    provider = CustomProvider(api_key="test", api_base="http://localhost:8000/v1", default_model="test-model")

    result = provider._parse_raw_response(
        {
            "id": "resp_sensitive_2",
            "choices": None,
            "input_sensitive": False,
            "input_sensitive_type": "policy_review",
        }
    )

    assert result.finish_reason == "error"
    assert "input_sensitive" in str(result.content)
    assert "policy_review" in str(result.content)


def test_custom_provider_parse_raw_response_reports_backend_status_payload() -> None:
    provider = CustomProvider(api_key="test", api_base="http://localhost:8000/v1", default_model="test-model")

    result = provider._parse_raw_response(
        {
            "status_code": 42901,
            "status_msg": "rate limited",
        }
    )

    assert result.finish_reason == "error"
    assert result.content == "Error: backend status 42901: rate limited"


def test_custom_provider_parse_raw_response_uses_nested_base_resp() -> None:
    provider = CustomProvider(api_key="test", api_base="http://localhost:8000/v1", default_model="test-model")

    result = provider._parse_raw_response(
        {
            "id": "outer",
            "base_resp": {
                "choices": [
                    {
                        "message": {
                            "content": "nested ok",
                            "tool_calls": [],
                        },
                        "finish_reason": "stop",
                    }
                ]
            },
        }
    )

    assert result.finish_reason == "stop"
    assert result.content == "nested ok"


def test_custom_provider_parse_raw_response_uses_nested_base_resp_when_top_level_choices_empty() -> None:
    provider = CustomProvider(api_key="test", api_base="http://localhost:8000/v1", default_model="test-model")

    result = provider._parse_raw_response(
        {
            "id": "outer-empty",
            "choices": [],
            "base_resp": {
                "choices": [
                    {
                        "message": {
                            "content": "nested from empty choices",
                            "tool_calls": [],
                        },
                        "finish_reason": "stop",
                    }
                ]
            },
        }
    )

    assert result.finish_reason == "stop"
    assert result.content == "nested from empty choices"


def test_custom_provider_parse_raw_response_surfaces_nested_base_resp_error_when_top_level_choices_empty() -> None:
    provider = CustomProvider(api_key="test", api_base="http://localhost:8000/v1", default_model="test-model")

    result = provider._parse_raw_response(
        {
            "choices": [],
            "base_resp": {
                "error": {"message": "backend overloaded"},
            },
            "usage": {"prompt_tokens": 1, "completion_tokens": 0, "total_tokens": 1},
        }
    )

    assert result.finish_reason == "error"
    assert result.content == "Error: backend overloaded"


def test_custom_provider_sanitize_messages_keeps_tool_ids_in_sync() -> None:
    messages = [
        {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "id": "call_function_9mwbnry4vx9s_5",
                    "type": "function",
                    "function": {"name": "market_brief", "arguments": "{}"},
                }
            ],
        },
        {
            "role": "tool",
            "tool_call_id": "call_function_9mwbnry4vx9s_5",
            "name": "market_brief",
            "content": "{}",
        },
    ]

    sanitized = CustomProvider._sanitize_messages(messages)

    assert sanitized[0]["tool_calls"][0]["id"] == sanitized[1]["tool_call_id"]
    assert sanitized[0]["tool_calls"][0]["id"] != "call_function_9mwbnry4vx9s_5"
    assert len(sanitized[0]["tool_calls"][0]["id"]) == 9


def test_custom_provider_parse_raw_response_accepts_dict_choices() -> None:
    provider = CustomProvider(api_key="test", api_base="http://localhost:8000/v1", default_model="test-model")

    result = provider._parse_raw_response(
        {
            "choices": {
                "message": {
                    "content": "dict choice ok",
                    "tool_calls": [],
                },
                "finish_reason": "stop",
            }
        }
    )

    assert result.finish_reason == "stop"
    assert result.content == "dict choice ok"


@patch("marketbot.providers.custom_provider.httpx.AsyncClient")
def test_custom_provider_chat_falls_back_to_raw_http_when_sdk_parse_fails(mock_client_cls) -> None:
    import asyncio

    provider = CustomProvider(api_key="test", api_base="http://localhost:8000/v1", default_model="test-model")
    provider._client.chat.completions.create = AsyncMock(side_effect=TypeError("'NoneType' object is not subscriptable"))

    mock_response = AsyncMock()
    mock_response.raise_for_status = Mock()
    mock_response.json = Mock(
        return_value={
            "choices": [
                {
                    "finish_reason": "tool_calls",
                    "message": {
                        "content": None,
                        "tool_calls": [
                            {
                                "id": "call_http_1",
                                "function": {
                                    "name": "browser_page",
                                    "arguments": '{"action":"open","target":"https://twitter.com/search?q=nvda"}',
                                },
                            }
                        ],
                    },
                }
            ],
            "usage": {"prompt_tokens": 5, "completion_tokens": 3, "total_tokens": 8},
        }
    )
    mock_context = AsyncMock()
    mock_context.post = AsyncMock(return_value=mock_response)
    mock_client_cls.return_value.__aenter__.return_value = mock_context

    result = asyncio.run(provider.chat(messages=[{"role": "user", "content": "use bb_browser"}]))

    assert result.finish_reason == "tool_calls"
    assert len(result.tool_calls) == 1
    assert result.tool_calls[0].name == "browser_page"
    assert result.tool_calls[0].arguments["action"] == "open"
