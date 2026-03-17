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
    assert "options-payoff" in names
    assert "pair-correlation" in names
    assert "earnings-readout" in names
    assert "vix-panic-reversion" in names
    assert "multi-llm-stock-panel" in names
    assert "sector-breadth" in names
    assert "macro-regime" in names
    assert "xueqiu-research" in names
    assert "eastmoney-live" in names
    assert "social-signal-browser" in names
    assert "reddit-research" in names
    assert "youtube-transcript-browser" in names
    assert "github-browser-research" in names
    assert "zhihu-browser-research" in names
    assert "browser-news-verifier" in names
    assert "weibo-browser-research" in names
    assert "bilibili-browser-research" in names
    assert "xiaohongshu-browser-research" in names
    assert "twitter-browser-research" in names
    assert "hackernews-browser-research" in names
    assert "douban-browser-research" in names
    assert "linkedin-browser-research" in names
    assert "stackoverflow-browser-research" in names
    assert "wikipedia-browser-research" in names


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


def test_new_specialist_skills_are_loadable(tmp_path):
    loader = SkillsLoader(tmp_path)

    options_content = loader.load_skill("options-payoff")
    correlation_content = loader.load_skill("pair-correlation")
    earnings_content = loader.load_skill("earnings-readout")

    assert options_content is not None
    assert "# Options Payoff" in options_content
    assert correlation_content is not None
    assert "# Pair Correlation" in correlation_content
    assert earnings_content is not None
    assert "# Earnings Readout" in earnings_content


def test_specialist_skills_sort_ahead_of_orchestrator_for_matching_request(tmp_path):
    loader = SkillsLoader(tmp_path)

    matched = loader.match_skills_for_request(
        "Analyze NVDA earnings results and guidance after the quarterly report.",
        route={"symbols": ["NVDA"], "equity": True},
        available_tools={"market_snapshot", "market_news", "market_event_extract", "market_fundamentals", "market_signal"},
    )

    assert matched
    assert matched[0] == "earnings-readout"


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

    assert "market_source_plan" in capabilities["tools"]
    assert "browser_site" in capabilities["tools"]
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


def test_daily_stock_screener_trigger_matching_uses_metadata(tmp_path):
    loader = SkillsLoader(tmp_path)

    matched = loader.match_skills_for_request(
        "Screen and rank this watchlist for today's top stock candidates: AAPL, NVDA, TSLA",
        route={"equity": True, "symbols": ["AAPL", "NVDA", "TSLA"]},
    )

    assert "daily-stock-screener" in matched


def test_market_discovery_trigger_matching_supports_chinese_opportunity_terms(tmp_path):
    loader = SkillsLoader(tmp_path)

    matched = loader.match_skills_for_request(
        "分析今日股票市场机会，给出值得关注的主题机会",
        route={"equity": True, "symbols": ["NVDA", "0700.HK", "513310"]},
    )

    assert "market-discovery" in matched


def test_vix_panic_reversion_trigger_matching_uses_metadata(tmp_path):
    loader = SkillsLoader(tmp_path)

    matched = loader.match_skills_for_request(
        "VIX > 35 的时候是否适合抄底，等 VIX < 20 再卖出？",
        route={"equity": True, "etf": True, "macro": True, "symbols": ["VIX", "SPY"]},
    )

    assert "vix-panic-reversion" in matched


def test_vix_alert_trigger_matching_supports_monitoring_language(tmp_path):
    loader = SkillsLoader(tmp_path)

    matched = loader.match_skills_for_request(
        "VIX > 35 自动提醒",
        route={"equity": True, "etf": True, "macro": True, "symbols": ["VIX", "SPY"]},
    )

    assert "vix-panic-reversion" in matched


def test_multi_llm_stock_panel_trigger_matching_supports_bb_browser_prompt(tmp_path):
    loader = SkillsLoader(tmp_path)

    matched = loader.match_skills_for_request(
        "使用bb-browser打开Gemini、ChatGPT、Grok，分析美股港股未来一个月内大幅上涨的股票并综合总结",
        route={"equity": True, "symbols": ["NVDA", "0700.HK"]},
    )

    assert "multi-llm-stock-panel" in matched


def test_multi_llm_stock_panel_capabilities_require_browser_page(tmp_path):
    loader = SkillsLoader(tmp_path)

    capabilities = loader.get_skill_capabilities("multi-llm-stock-panel")

    assert "browser_page" in capabilities["tools"]
    assert capabilities["required_tools"] == ["browser_page", "market_snapshot"]


def test_multi_llm_stock_panel_mentions_panel_availability(tmp_path):
    loader = SkillsLoader(tmp_path)

    content = loader.load_skill("multi-llm-stock-panel")

    assert content is not None
    assert "## Panel Availability" in content
    assert "do not fall back to `market_snapshot`" in content
    assert "One ordered sweep only" in content


def test_external_skill_catalog_parser_extracts_curated_entries(tmp_path):
    loader = SkillsLoader(tmp_path)
    sample = """
### Market Intelligence
- [Daily Stock Screener](https://github.com/openclaw/skills/tree/main/skills/daily-stock-screener) - Screen stock watchlists into ranked candidates.
- [Macro Radar](https://github.com/openclaw/skills/tree/main/skills/macro-radar) - Track macro catalysts and market regime changes.
"""

    entries = loader._parse_awesome_openclaw_readme(sample)

    assert entries[0]["name"] == "daily-stock-screener"
    assert entries[0]["category"] == "Market Intelligence"
    assert "ranked candidates" in entries[0]["description"]
    assert entries[0]["catalog"] == "https://github.com/VoltAgent/awesome-openclaw-skills"
    assert entries[0]["repository"] == "https://github.com/openclaw/skills"


def test_external_skill_search_returns_ranked_matches(tmp_path, monkeypatch):
    loader = SkillsLoader(tmp_path)
    monkeypatch.setattr(
        loader,
        "_load_external_catalog_entries",
        lambda: [
            {
                "name": "daily-stock-screener",
                "title": "Daily Stock Screener",
                "description": "Screen stock watchlists into ranked candidates.",
                "category": "Market Intelligence",
                "url": "https://github.com/openclaw/skills/tree/main/skills/daily-stock-screener",
            },
            {
                "name": "k8s-release",
                "title": "K8s Release",
                "description": "Deploy Kubernetes apps with Helm and ArgoCD.",
                "category": "DevOps",
                "url": "https://github.com/openclaw/skills/tree/main/skills/k8s-release",
            },
        ],
    )

    results = loader.search_external_skills("Need a stock screener to rank my watchlist", limit=3)

    assert results
    assert results[0]["name"] == "daily-stock-screener"


def test_external_skill_slug_resolution_supports_slug_and_url(tmp_path, monkeypatch):
    loader = SkillsLoader(tmp_path)
    monkeypatch.setattr(
        loader,
        "_load_external_catalog_entries",
        lambda: [
            {
                "name": "daily-stock-screener",
                "title": "Daily Stock Screener",
                "description": "Screen stock watchlists into ranked candidates.",
                "category": "Market Intelligence",
                "url": "https://github.com/openclaw/skills/tree/main/skills/daily-stock-screener",
            }
        ],
    )

    assert loader._resolve_external_skill_slug("daily-stock-screener") == "daily-stock-screener"
    assert (
        loader._resolve_external_skill_slug(
            "https://github.com/openclaw/skills/tree/main/skills/daily-stock-screener"
        )
        == "daily-stock-screener"
    )
    assert loader._resolve_external_skill_slug("unknown-skill") is None


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


def test_skills_summary_includes_browser_adapter_catalog(tmp_path):
    loader = SkillsLoader(tmp_path)

    summary = loader.build_skills_summary(browser_adapter_catalog=["xueqiu/hot-stock", "reddit/search"])

    assert "<browserAdapters>" in summary
    assert "<adapter>xueqiu/hot-stock</adapter>" in summary
    assert "<adapter>reddit/search</adapter>" in summary


def test_high_traffic_browser_skills_ship_adapter_reference_files(tmp_path):
    loader = SkillsLoader(tmp_path)
    skill_names = [
        "xueqiu-research",
        "eastmoney-live",
        "reddit-research",
        "youtube-transcript-browser",
        "browser-news-verifier",
        "twitter-browser-research",
        "bilibili-browser-research",
        "xiaohongshu-browser-research",
    ]

    for skill_name in skill_names:
        skill_path = loader.builtin_skills / skill_name / "references" / "adapter-examples.md"
        assert skill_path.exists(), f"missing adapter reference for {skill_name}"
