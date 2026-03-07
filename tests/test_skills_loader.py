from marketbot.agent.skills import SkillsLoader


def test_builtin_market_skills_are_discoverable(tmp_path):
    loader = SkillsLoader(tmp_path)

    names = {item["name"] for item in loader.list_skills(filter_unavailable=False)}

    assert "market-report" in names
    assert "catalyst-tracker" in names
    assert "risk-checklist" in names
    assert "stock-info-explorer" in names
    assert "crypto-gold-monitor" in names


def test_market_report_skill_content_is_loadable(tmp_path):
    loader = SkillsLoader(tmp_path)

    content = loader.load_skill("market-report")

    assert content is not None
    assert "# Market Report" in content
