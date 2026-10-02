[English](english_first_language_evaluation_2026-10-03.md) | [简体中文](english_first_language_evaluation_2026-10-03_zh-CN.md)

# English-first language evaluation — 2026-10-03

MarketBot now defaults to English and supports Simplified Chinese. The canonical README and the finance and integration guides each have complete Chinese counterparts. `README_en.md` preserves the previous English entry point.

| Validation | Result |
| --- | --- |
| Complete Python regression suite | 1332 passed, zero failures or skips |
| Deterministic financial acceptance | 15/15 passed |
| README offline workflows | 13/13 passed |
| Fresh wheel outside the repository, including public-source probes | 14/14 passed |
| CLI and documentation inventory | 53 command/help entries; 137 documented commands; 14 language selectors |
| Native tools / MCP / skills | 18 native tools; 12 read-only MCP tools; 63 bundled skills |
| Ruff and whitespace validation | Passed |
| Secrets scan | Passed; the new provider-key test fixture was reviewed as a non-secret |
| Package contents | English metadata, all seven bilingual entry documents in the source archive, six bridge assets, no cookies or node_modules |

The [installed-wheel walkthrough JSON](evaluation/english_first_walkthrough_2026-10-03.json) records the actual CLI, HTTP, MCP and public-source checks. The [financial acceptance JSON](evaluation/english_first_finance_2026-10-03.json) records the 15 deterministic financial checks.

## Language behavior verified

`agents.defaults.language` defaults to `en`; `zh` selects Simplified Chinese. Global `--language` overrides one ordinary invocation without changing the saved configuration. `language --set` saves only the selected language, preserving the stored workspace and provider settings. Creating or refreshing configuration through `onboard` saves its selected language.

Two independent Agent sessions made four actual HTTP requests to a local protocol fixture. Their system policies were `[en, en, zh, zh]`; each session executed the real portfolio tool, returned `0.02 USD`, persisted evidence and saved its conversation. The model fixture verifies protocol and propagation, not the quality of a real model's prose.

Explicit output-language requests take precedence for Agent response presentation. Tests cover Chinese and English directives, negated directives, consecutive turns, concurrent tasks, nested scopes and exceptions. Reports, notices, brief logic chains and Feishu acknowledgments use the effective response language. An explicit `market_brief` language argument overrides that tool's default.

English and Chinese runs retain financial JSON field names, portfolio calculations, source text, URLs, observation times and user-authored workspace instructions. The language walkthrough preserved both RSS items and original quote warnings. Its deliberately disabled mock quote source returned zero quotes; no illustrative prices were presented as retrieved observations.

## Repairs included

- Daily report normalization now honors an explicit language request instead of replacing its headings with the configured default.
- Briefs, report notifications, intelligence digests and scheduled handlers receive the selected language.
- Saved market reports retain news source URLs.
- Unknown macro risk is identified as a neutral compatibility default rather than an observed estimate. Missing report metrics display `unavailable` instead of zero.
- Source packages include both complete READMEs and both languages of the finance and integration guides. Package metadata uses the English README.

## Public data and untested integrations

Public quotes were retrieved for `600519`, `00700` and `SPY`. The A-share observation was dated September 30, the Hong Kong observation October 2, and SPY lacked a confirmed observation time. The probe returned zero usable news items and missing-FRED-key warnings. These results test retrieval and honest missing-data handling; they do not independently verify price accuracy or establish current quotes.

Real model quality, authenticated channel delivery, account-dependent browser/Lark/Twitter/Xiaohongshu workflows, Docker execution and GPU/Slime training were not tested. Existing regression and protocol tests cover their configured contracts. The technical `--help` reference, protocol names, financial tool warnings and original provider errors retain their source language.

## Reproduce

```bash
python -m pytest tests
python scripts/evaluate_finance.py --output .local/finance-evaluation.json
python scripts/evaluate_readme.py --output .local/readme-evaluation.json
uv build
uv venv .local/wheel-check
uv pip install --python .local/wheel-check/bin/python dist/*.whl
python scripts/evaluate_readme.py --python "$PWD/.local/wheel-check/bin/python" --network --output .local/wheel-evaluation.json
```

The evaluator runs its CLI subprocesses in temporary directories. The installed-wheel check must use the fresh environment's Python rather than an editable installation.
