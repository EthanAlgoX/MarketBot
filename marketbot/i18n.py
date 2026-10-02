"""Small language helpers for human-readable output."""

from enum import Enum


class Language(str, Enum):
    en = "en"
    zh = "zh"


def msg(english: str, chinese: str, language: str | Language = "en") -> str:
    """Choose human-facing text without translating identifiers or source data."""
    return chinese if language == Language.zh else english


localized = msg
