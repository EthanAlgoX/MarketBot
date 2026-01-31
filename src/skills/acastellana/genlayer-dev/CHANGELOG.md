# Changelog

All notable changes to this skill will be documented in this file.

## [1.0.0] - 2026-01-30

### Added
- Initial public release
- Complete SDK API reference (`references/sdk-api.md`)
- Contract examples with annotations (`references/examples.md`):
  - Storage Contract (basic)
  - User Storage (per-address data)
  - Wizard of Coin (LLM decision making)
  - Football Prediction Market (web + LLM)
  - LLM ERC20 (token with AI validation)
  - Log Indexer (vector embeddings)
  - Intelligent Oracle (simple)
  - Production Oracle (full-featured)
- Equivalence Principles guide (`references/equivalence-principles.md`)
- Deployment guide with CLI commands (`references/deployment.md`)
- GenVM internals documentation (`references/genvm-internals.md`)
- Cross-link to companion `genlayer-claw-skill` for concepts/pitching

### Fixed
- Production Oracle example updated to use current SDK API:
  - `gl.nondet.exec_prompt()` instead of `gl.exec_prompt()`
  - `gl.nondet.web.render()` instead of `gl.get_webpage()`
  - `gl.eq_principle.prompt_comparative()` instead of `gl.eq_principle_prompt_comparative()`
  - `gl.message.sender_address` instead of `gl.message.sender_account`
  - Proper class definition with `gl.Contract` instead of `@gl.contract` decorator

### Changed
- Expanded trigger keywords for better discoverability
