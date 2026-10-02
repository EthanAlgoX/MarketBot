"""Explicit response-language preferences scoped to one asynchronous request."""

import re
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Iterator

_RESPONSE_LANGUAGE: ContextVar[str | None] = ContextVar("marketbot_response_language", default=None)
_DIRECTIVES = (
    re.compile(r"\b(?:reply|respond|answer|write|speak|communicate|output|summarize|summarise)\s+(?:to\s+me\s+)?(?:in|using)\s+(?:simplified\s+)?(?P<language>english|chinese|mandarin)\b", re.I),
    re.compile(r"\b(?:report|response|answer|summary)\s+in\s+(?:simplified\s+)?(?P<language>english|chinese|mandarin)\b", re.I),
    re.compile(r"\buse\s+(?P<language>english|chinese|mandarin)(?=\s*(?:[.!?;\n]|$|for\s+(?:the\s+)?(?:reply|response|answer|report)))", re.I),
    re.compile(r"(?:用|使用|以)\s*(?:简体)?(?P<language>中文|汉语|英文|英语)(?=\s*(?:回答|回复|输出|撰写|写|总结|分析|解释|生成|提供|做|给出|返回|呈现|给我|帮我|[。，！？；:：\n]|$))"),
    re.compile(r"(?P<language>中文|汉语|英文|英语)\s*(?:回答|回复|输出|撰写|总结|解释)"),
)
_NEGATED_PREFIX = re.compile(r"(?:\b(?:do\s+not|don['’]t|never|not)\s+(?:\w+\s+){0,4}|(?:不要|不用|无需|别)\s*(?:使用|用|以)?)\s*$", re.I)


def resolve_response_language(text: str | None, default: str = "en") -> str:
    """Honor explicit output-language instructions, without detecting input language."""
    default = "zh" if default == "zh" else "en"
    if not text:
        return default
    directives = []
    for pattern in _DIRECTIVES:
        for match in pattern.finditer(text):
            if _NEGATED_PREFIX.search(text[max(0, match.start() - 24):match.start()]):
                continue
            name = match.group("language").lower()
            directives.append((match.end(), "en" if name in {"english", "英文", "英语"} else "zh"))
    return max(directives)[1] if directives else default


def effective_response_language(default: str = "en") -> str:
    """Use the current request preference, falling back to the configured default."""
    return _RESPONSE_LANGUAGE.get() or ("zh" if default == "zh" else "en")


@contextmanager
def response_language_scope(text: str | None, default: str = "en") -> Iterator[str]:
    """Set and restore a preference; ContextVar isolates concurrent sessions."""
    language = resolve_response_language(text, default)
    token = _RESPONSE_LANGUAGE.set(language)
    try:
        yield language
    finally:
        _RESPONSE_LANGUAGE.reset(token)
