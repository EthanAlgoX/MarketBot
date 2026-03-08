from marketbot.agent.skills import SkillsLoader
from marketbot.config.schema import MarketToolsConfig
from marketbot.domain.market import build_market_runtime_profile


def test_builtin_market_skills_are_discoverable(tmp_path):
    loader = SkillsLoader(tmp_path)

    names = {item["name"] for item in loader.list_skills(filter_unavailable=False)}

    assert "daily-stock-screener" in names
    assert "market-report" in names
    assert "catalyst-tracker" in names
    assert "risk-checklist" in names
    assert "stock-data-sourcing" in names
    assert "stock-info-explorer" in names
    assert "crypto-gold-monitor" in names


def test_market_report_skill_content_is_loadable(tmp_path):
    loader = SkillsLoader(tmp_path)

    content = loader.load_skill("market-report")

    assert content is not None
    assert "# Market Report" in content


def test_stock_data_sourcing_skill_content_is_loadable(tmp_path):
    loader = SkillsLoader(tmp_path)

    content = loader.load_skill("stock-data-sourcing")

    assert content is not None
    assert "# Stock Data Sourcing" in content
    assert "efinance" in content


def test_market_skill_capabilities_are_parsed(tmp_path):
    loader = SkillsLoader(tmp_path)

    capabilities = loader.get_skill_capabilities("market-report")

    assert "analysis" in capabilities["triggers"]
    assert capabilities["output"] == "market-analysis-report"
    assert capabilities["risk"] == "medium"
    assert capabilities["freshness"] == "market-live"
    assert capabilities["required_tools"] == ["market_snapshot", "market_signal"]
    assert "equity" in capabilities["asset_classes"]
    assert "us" in capabilities["markets"]


def test_stock_data_sourcing_capabilities_include_tool_alignment(tmp_path):
    loader = SkillsLoader(tmp_path)

    capabilities = loader.get_skill_capabilities("stock-data-sourcing")

    assert capabilities["tools"] == ["market_source_plan"]
    assert capabilities["required_tools"] == ["market_source_plan"]
    assert capabilities["markets"] == ["a-share", "hong-kong", "us", "mixed"]


def test_daily_stock_screener_capabilities_are_parsed(tmp_path):
    loader = SkillsLoader(tmp_path)

    capabilities = loader.get_skill_capabilities("daily-stock-screener")

    assert "screener" in capabilities["triggers"]
    assert capabilities["output"] == "daily-stock-screener-report"
    assert capabilities["risk"] == "medium"
    assert capabilities["freshness"] == "market-live"
    assert capabilities["required_tools"] == ["market_snapshot", "market_news", "market_fundamentals"]
    assert capabilities["markets"] == ["a-share", "hong-kong", "us", "mixed"]
    assert capabilities["asset_classes"] == ["equity"]


def test_skill_trigger_matching_uses_metadata(tmp_path):
    loader = SkillsLoader(tmp_path)

    matched = loader.match_skills_for_request(
        "Need a catalyst calendar and event risk view for NVDA",
        route={"equity": True, "symbols": ["NVDA"]},
    )

    assert "catalyst-tracker" in matched


def test_skill_compatibility_filters_mismatched_asset_classes(tmp_path):
    loader = SkillsLoader(tmp_path)

    assert loader.is_skill_compatible(
        "portfolio-analyzer",
        "Analyze my portfolio allocation and diversification risk.",
        route={"symbols": [], "equity": False},
    )
    assert not loader.is_skill_compatible(
        "portfolio-analyzer",
        "Analyze NVDA swing setup with catalysts and stop loss.",
        route={"symbols": ["NVDA"], "equity": True},
    )


def test_skill_compatibility_respects_required_tools(tmp_path):
    loader = SkillsLoader(tmp_path)

    assert loader.is_skill_compatible(
        "market-report",
        "Analyze NVDA swing setup.",
        route={"symbols": ["NVDA"], "equity": True},
        available_tools={"market_snapshot", "market_signal"},
    )
    assert not loader.is_skill_compatible(
        "market-report",
        "Analyze NVDA swing setup.",
        route={"symbols": ["NVDA"], "equity": True},
        available_tools={"market_snapshot"},
    )

    diagnostic = loader.explain_skill_compatibility(
        "market-report",
        "Analyze NVDA swing setup.",
        route={"symbols": ["NVDA"], "equity": True},
        available_tools={"market_snapshot"},
    )

    assert diagnostic["compatible"] is False
    assert any("missing tools: market_signal" in reason for reason in diagnostic["reasons"])


def test_skill_compatibility_respects_runtime_market_profile(tmp_path):
    loader = SkillsLoader(tmp_path)
    cfg = MarketToolsConfig(quote_source="eastmoney")
    runtime_profile = build_market_runtime_profile(cfg)

    assert loader.is_skill_compatible(
        "market-report",
        "分析 600519 的趋势和交易计划。",
        route={"symbols": ["600519"], "equity": True},
        available_tools={"market_snapshot", "market_signal"},
        runtime_profile=runtime_profile,
    )
    assert not loader.is_skill_compatible(
        "market-report",
        "Analyze AAPL trend and trade plan.",
        route={"symbols": ["AAPL"], "equity": True},
        available_tools={"market_snapshot", "market_signal"},
        runtime_profile=runtime_profile,
    )


def test_news_skill_compatibility_respects_provider_market_coverage(tmp_path):
    loader = SkillsLoader(tmp_path)
    cfg = MarketToolsConfig()
    cfg.news_sources = ["bocha"]
    cfg.bocha_api_key = "bocha-key"
    runtime_profile = build_market_runtime_profile(cfg)

    assert loader.is_skill_compatible(
        "news-intelligence",
        "分析 0700.HK 最近新闻影响。",
        route={"symbols": ["0700.HK"], "equity": True},
        available_tools={"market_news"},
        runtime_profile=runtime_profile,
    )
    assert not loader.is_skill_compatible(
        "news-intelligence",
        "Analyze AAPL headline impact.",
        route={"symbols": ["AAPL"], "equity": True},
        available_tools={"market_news"},
        runtime_profile=runtime_profile,
    )
    diagnostic = loader.explain_skill_compatibility(
        "news-intelligence",
        "Analyze AAPL headline impact.",
        route={"symbols": ["AAPL"], "equity": True},
        available_tools={"market_news"},
        runtime_profile=runtime_profile,
    )
    assert any("runtime market coverage mismatch" in reason for reason in diagnostic["reasons"])


def test_skills_summary_includes_capabilities(tmp_path):
    loader = SkillsLoader(tmp_path)

    summary = loader.build_skills_summary()

    assert "<triggers>analysis, outlook, trade plan, bias</triggers>" in summary
    assert "<output>market-analysis-report</output>" in summary
    assert "<risk>high</risk>" in summary
    assert "<tools>market_source_plan</tools>" in summary
    assert "<requiredTools>market_source_plan</requiredTools>" in summary
    assert "<assetClasses>portfolio</assetClasses>" in summary


def test_skills_summary_marks_missing_runtime_tools(tmp_path):
    loader = SkillsLoader(tmp_path)

    summary = loader.build_skills_summary(available_tools={"market_snapshot"})

    assert '<skill available="false">' in summary
    assert "Tool: market_signal" in summary
