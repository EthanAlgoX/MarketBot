from marketbot.agent.skills import SkillsLoader
from marketbot.config.schema import MarketToolsConfig
from marketbot.domain.market import build_market_runtime_profile
import json
from pathlib import Path


def _write_workspace_skill(
    workspace: Path,
    name: str,
    *,
    description: str,
    triggers: list[str],
    priority: int = 50,
    task_type: str = "general",
) -> None:
    skill_dir = workspace / "skills" / name
    skill_dir.mkdir(parents=True, exist_ok=True)
    metadata = {
        "marketbot": {
            "triggers": triggers,
            "priority": priority,
            "task_type": task_type,
        }
    }
    content = (
        "---\n"
        f"name: {name}\n"
        f"description: {description}\n"
        f"metadata: {json.dumps(metadata, ensure_ascii=False)}\n"
        "---\n\n"
        f"# {name}\n"
    )
    (skill_dir / "SKILL.md").write_text(content, encoding="utf-8")


def test_builtin_market_skills_are_discoverable(tmp_path):
    loader = SkillsLoader(tmp_path)

    names = {item["name"] for item in loader.list_skills(filter_unavailable=False)}

    assert "ak-rss-digest" in names
    assert "tech-news-digest" in names
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
    assert "panic-reversion-monitor" in names
    assert "thesis-tracker" in names
    assert "logic-chain-visualizer" in names
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


def test_ak_rss_digest_skill_content_is_loadable(tmp_path):
    loader = SkillsLoader(tmp_path)

    content = loader.load_skill("ak-rss-digest")

    assert content is not None
    assert "# AK RSS Digest" in content


def test_tech_news_digest_skill_content_is_loadable(tmp_path):
    loader = SkillsLoader(tmp_path)

    content = loader.load_skill("tech-news-digest")

    assert content is not None
    assert "# Tech News Digest" in content


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
    thesis_content = loader.load_skill("thesis-tracker")
    visualizer_content = loader.load_skill("logic-chain-visualizer")

    assert options_content is not None
    assert "# Options Payoff" in options_content
    assert correlation_content is not None
    assert "# Pair Correlation" in correlation_content
    assert earnings_content is not None
    assert "# Earnings Readout" in earnings_content
    assert thesis_content is not None
    assert "# Thesis Tracker" in thesis_content
    assert visualizer_content is not None
    assert "# Logic Chain Visualizer" in visualizer_content


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


def test_ak_rss_digest_capabilities_are_parsed(tmp_path):
    loader = SkillsLoader(tmp_path)

    capabilities = loader.get_skill_capabilities("ak-rss-digest")

    assert "rss digest" in capabilities["triggers"]
    assert capabilities["output"] == "ai-reading-digest"
    assert capabilities["risk"] == "low"
    assert capabilities["freshness"] == "live"
    assert capabilities["required_tools"] == ["exec"]
    assert capabilities["tools"] == ["exec", "web_fetch"]
    assert capabilities["markets"] == ["global"]


def test_tech_news_digest_capabilities_are_parsed(tmp_path):
    loader = SkillsLoader(tmp_path)

    capabilities = loader.get_skill_capabilities("tech-news-digest")

    assert "tech news" in capabilities["triggers"]
    assert capabilities["output"] == "tech-news-digest-report"
    assert capabilities["risk"] == "low"
    assert capabilities["freshness"] == "live"
    assert capabilities["required_tools"] == ["web_fetch"]
    assert "browser_page" in capabilities["tools"]
    assert capabilities["markets"] == ["global"]


def test_ak_rss_digest_ships_script_and_feeds_reference(tmp_path):
    loader = SkillsLoader(tmp_path)

    script_path = loader.builtin_skills / "ak-rss-digest" / "scripts" / "fetch_today_feed_items.py"
    feeds_path = loader.builtin_skills / "ak-rss-digest" / "references" / "feeds.opml"

    assert script_path.exists()
    assert feeds_path.exists()


def test_tech_news_digest_ships_script_and_valid_source_catalog(tmp_path):
    loader = SkillsLoader(tmp_path)

    script_path = loader.builtin_skills / "tech-news-digest" / "scripts" / "collect_sources.py"
    catalog_path = loader.builtin_skills / "tech-news-digest" / "references" / "sources.json"
    template_path = loader.builtin_skills / "tech-news-digest" / "references" / "report-template.md"

    assert script_path.exists()
    assert template_path.exists()
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    assert "sources" in catalog
    assert "tier1" in catalog["sources"]
    assert "tier2" in catalog["sources"]
    assert "tier3_browser" in catalog["sources"]
    content = loader.load_skill("tech-news-digest")
    assert content is not None
    assert "--output" in content


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


def test_market_discovery_capabilities_use_market_brief_anchor(tmp_path):
    loader = SkillsLoader(tmp_path)

    capabilities = loader.get_skill_capabilities("market-discovery")

    assert "market_brief" in capabilities["tools"]
    assert "thesis_tracker" in capabilities["tools"]
    assert capabilities["required_tools"] == ["market_snapshot", "market_news", "market_brief"]


def test_stock_watch_capabilities_use_market_brief_anchor(tmp_path):
    loader = SkillsLoader(tmp_path)

    capabilities = loader.get_skill_capabilities("stock-watch")

    assert "market_brief" in capabilities["tools"]
    assert "thesis_tracker" in capabilities["tools"]
    assert capabilities["required_tools"] == ["market_snapshot", "market_news", "market_brief"]


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


def test_dynamic_skill_score_reorders_similar_workspace_skills(tmp_path):
    _write_workspace_skill(
        tmp_path,
        "alpha-news-backup",
        description="alpha backup",
        triggers=["rare alpha trigger"],
        task_type="news-verification",
    )
    _write_workspace_skill(
        tmp_path,
        "beta-news-backup",
        description="beta backup",
        triggers=["rare alpha trigger"],
        task_type="news-verification",
    )
    loader = SkillsLoader(tmp_path)

    initial = loader.match_skills_for_request("Need rare alpha trigger now")
    assert initial[:2] == ["alpha-news-backup", "beta-news-backup"]

    loader.record_skill_outcome(
        name="beta-news-backup",
        text="Need rare alpha trigger now",
        outcome="success",
    )
    reranked = loader.match_skills_for_request("Need rare alpha trigger now")
    assert reranked[:2] == ["beta-news-backup", "alpha-news-backup"]


def test_dynamic_skill_score_is_bucketed_by_market(tmp_path):
    _write_workspace_skill(
        tmp_path,
        "market-bucket-skill",
        description="bucket test",
        triggers=["bucket trigger"],
        task_type="browser-research",
    )
    loader = SkillsLoader(tmp_path)

    loader.record_skill_outcome(
        name="market-bucket-skill",
        text="分析 A股 bucket trigger 600519",
        outcome="success",
        route={"symbols": ["600519"], "equity": True},
    )

    a_share = loader.explain_skill_compatibility(
        "market-bucket-skill",
        "分析 A股 bucket trigger 600519",
        route={"symbols": ["600519"], "equity": True},
    )
    us_market = loader.explain_skill_compatibility(
        "market-bucket-skill",
        "Analyze bucket trigger for NVDA",
        route={"symbols": ["NVDA"], "equity": True},
    )

    assert a_share["dynamicScore"] > 0
    assert us_market["dynamicScore"] == 0


def test_ak_rss_digest_trigger_matching_respects_exec_tool(tmp_path):
    loader = SkillsLoader(tmp_path)

    matched = loader.match_skills_for_request(
        "请做一个 AI 日报，从固定 RSS 里整理阅读摘要。",
        available_tools={"exec", "web_fetch"},
    )

    assert "ak-rss-digest" in matched


def test_tech_news_digest_trigger_matching_respects_web_fetch_tool(tmp_path):
    loader = SkillsLoader(tmp_path)

    matched = loader.match_skills_for_request(
        "Generate a tech news digest covering today's AI news and major product updates.",
        available_tools={"web_fetch", "read_file", "write_file"},
    )

    assert "tech-news-digest" in matched


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


def test_panic_reversion_monitor_content_is_loadable(tmp_path):
    loader = SkillsLoader(tmp_path)

    content = loader.load_skill("panic-reversion-monitor")

    assert content is not None
    assert "# Panic Reversion Monitor" in content
    assert "Panic Coefficient" in content
    assert "Drawdown From High" in content
    assert "Recent high anchor selection" in content
    assert "heartbeat-template.md" in content


def test_panic_reversion_monitor_trigger_matching_uses_metadata(tmp_path):
    loader = SkillsLoader(tmp_path)

    matched = loader.match_skills_for_request(
        "监控 07709 的恐慌系数，找战争冲击后的错杀修复和抄底时机。",
        route={"equity": True, "etf": True, "symbols": ["07709"]},
    )

    assert "panic-reversion-monitor" in matched


def test_panic_reversion_monitor_trigger_matching_supports_drawdown_cause_and_progress_language(tmp_path):
    loader = SkillsLoader(tmp_path)

    matched = loader.match_skills_for_request(
        "监控 07709 从近期高点跌了多少、为什么跌、以及这次战争事件进展到哪一步。",
        route={"equity": True, "etf": True, "symbols": ["07709"]},
    )

    assert "panic-reversion-monitor" in matched


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


def test_xiaohongshu_skill_accepts_alternative_runtime_tool(tmp_path):
    loader = SkillsLoader(tmp_path)

    capabilities = loader.get_skill_capabilities("xiaohongshu-browser-research")
    assert capabilities["required_tools"] == ["xiaohongshu_cli"]
    assert capabilities["alternative_required_tools"] == ["browser_site"]

    xhs_only = loader.build_skills_summary(available_tools={"xiaohongshu_cli"})
    assert '<name>xiaohongshu-browser-research</name>' in xhs_only
    assert 'available="true"' in xhs_only

    browser_only = loader.build_skills_summary(available_tools={"browser_site"})
    assert '<name>xiaohongshu-browser-research</name>' in browser_only
    assert 'available="true"' in browser_only

    publish_capabilities = loader.get_skill_capabilities("xiaohongshu-publisher")
    assert "发布小红书" in publish_capabilities["triggers"]
    assert publish_capabilities["required_tools"] == ["xiaohongshu_cli"]

    publish_summary = loader.build_skills_summary(available_tools={"xiaohongshu_cli"})
    assert '<name>xiaohongshu-publisher</name>' in publish_summary
    assert 'available="true"' in publish_summary


def test_twitter_skill_accepts_alternative_runtime_tool(tmp_path):
    loader = SkillsLoader(tmp_path)

    capabilities = loader.get_skill_capabilities("twitter-browser-research")
    assert capabilities["required_tools"] == ["twitter_cli"]
    assert capabilities["alternative_required_tools"] == ["browser_site"]

    twitter_only = loader.build_skills_summary(available_tools={"twitter_cli"})
    assert '<name>twitter-browser-research</name>' in twitter_only
    assert 'available="true"' in twitter_only

    browser_only = loader.build_skills_summary(available_tools={"browser_site"})
    assert '<name>twitter-browser-research</name>' in browser_only
    assert 'available="true"' in browser_only

    publish_capabilities = loader.get_skill_capabilities("twitter-publisher")
    assert "post to twitter" in publish_capabilities["triggers"]
    assert publish_capabilities["required_tools"] == ["twitter_cli"]

    publish_summary = loader.build_skills_summary(available_tools={"twitter_cli"})
    assert '<name>twitter-publisher</name>' in publish_summary
    assert 'available="true"' in publish_summary


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
