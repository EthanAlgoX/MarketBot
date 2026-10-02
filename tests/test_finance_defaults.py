"""Default financial research identity and bilingual skill routing."""

import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

from marketbot.agent.context import ContextBuilder
from marketbot.agent.skills import BUILTIN_SKILLS_DIR, SkillsLoader
from marketbot.config.schema import MarketToolsConfig
from marketbot.domain.market import build_market_runtime_profile
from marketbot.utils.helpers import sync_workspace_templates

MARKET_TOOLS = {
    "market_snapshot", "market_signal", "market_news", "market_event_extract",
    "market_macro", "market_fundamentals", "market_source_plan", "read_file",
    "portfolio_risk",
}


def _builder(workspace: Path) -> ContextBuilder:
    builder = ContextBuilder(workspace)
    builder.set_available_tools(MARKET_TOOLS)
    builder.set_market_runtime_profile(build_market_runtime_profile(MarketToolsConfig(quote_source="auto")))
    return builder


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        (
            "分析美股 NVDA 的走势、催化剂和风险，给出仓位与止损条件。",
            {"market-report", "catalyst-tracker", "risk-checklist"},
        ),
        (
            "Analyze NVDA catalysts and risk, including position size and stop loss.",
            {"market-report", "catalyst-tracker", "risk-checklist"},
        ),
        (
            "分析投资组合 AAPL 30%, NVDA 30%, SPY 40% 的资产配置和分散投资风险。",
            {"portfolio-analyzer"},
        ),
        (
            "请进行 NVDA 的 MCP 财务数据补充。",
            {"finance-mcp"},
        ),
        (
            "Review my holdings: AAPL 10 shares and 0700.HK 100 shares, including portfolio risk.",
            {"portfolio-analyzer"},
        ),
    ],
)
def test_financial_requests_select_bundled_skills(tmp_path, query, expected):
    builder = _builder(tmp_path)

    builder.build_messages(history=[], current_message=query)

    routing = builder.get_last_skill_routing()
    selected = {item["name"] for item in routing["selected"]}
    assert expected <= selected


def test_portfolio_profile_recognizes_chinese_allocation(tmp_path):
    profile = SkillsLoader(tmp_path)._build_request_profile("检查持仓组合的组合风险与资产配置。")

    assert "portfolio" in profile["asset_classes"]


def test_portfolio_skill_requires_deterministic_calculation_tool(tmp_path):
    loader = SkillsLoader(tmp_path)
    query = "检查持仓组合的组合风险与资产配置。"
    assert not loader.is_skill_compatible(
        "portfolio-analyzer", query, available_tools={"market_snapshot", "market_news"},
    )
    assert loader.is_skill_compatible(
        "portfolio-analyzer", query, available_tools={"market_snapshot", "portfolio_risk"},
    )


def test_finance_identity_uses_actual_builtin_skill_directory(tmp_path):
    builder = _builder(tmp_path)

    prompt = builder.build_system_prompt()

    assert "financial research AI agent" in prompt
    assert f"{BUILTIN_SKILLS_DIR.resolve()}/{{skill-name}}/SKILL.md" in prompt
    assert f"{tmp_path}/marketbot/skills/" not in prompt


def test_finance_templates_preserve_user_customizations(tmp_path):
    (tmp_path / "SOUL.md").write_text("my custom agent identity", encoding="utf-8")

    sync_workspace_templates(tmp_path, silent=True)

    assert (tmp_path / "SOUL.md").read_text(encoding="utf-8") == "my custom agent identity"
    instructions = (tmp_path / "AGENTS.md").read_text(encoding="utf-8")
    assert "financial research AI agent" in instructions
    assert "invalidation" in instructions


def test_always_skills_respect_available_runtime_tools(tmp_path):
    skill_dir = tmp_path / "skills" / "custom-feed"
    skill_dir.mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text(
        '---\nname: custom-feed\nmetadata: {"marketbot":{"always":true,"required_tools":["custom_quote"]}}\n---\n\n# Custom Feed\n',
        encoding="utf-8",
    )
    loader = SkillsLoader(tmp_path)

    assert "custom-feed" not in loader.get_always_skills(available_tools={"read_file"})
    assert "custom-feed" in loader.get_always_skills(available_tools={"custom_quote"})


def test_skills_summary_preserves_special_characters_in_paths(tmp_path):
    workspace = tmp_path / "research & analysis"
    loader = SkillsLoader(workspace)
    skill_dir = workspace / "skills" / "custom-research"
    skill_dir.mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text(
        '---\nname: custom-research\ndescription: Research\n---\n\n# Research\n',
        encoding="utf-8",
    )

    summary = ET.fromstring(loader.build_skills_summary())
    entry = next(item for item in summary.findall("skill") if item.findtext("name") == "custom-research")

    assert entry.findtext("location") == str(skill_dir / "SKILL.md")
