# MarketBot CLI Acceptance Checklist

MarketBot is CLI-first for the current refactor stage. This checklist separates
automated local verification from external acceptance that requires real accounts,
provider credentials, market data connectivity, or chat-channel tokens.

## Automated Local Verification

- Python unit suite: `python -m pytest tests -q`
- Python syntax/import compilation: `python -m compileall -q marketbot tests`
- Python lint: `python -m ruff check .`
- CLI smoke:
  - `python -m marketbot --help`
  - `python -m marketbot status --json`
  - `python -m marketbot agent --help`
  - `python -m marketbot gateway --help`
  - `python -m marketbot channels status --json`
  - `python -m marketbot skills score list --json`
- WhatsApp bridge:
  - `npm install --no-package-lock`
  - `npm test`
  - `npm run build`
- Claw screener:
  - `npm ci`
  - `npm test`
  - `npm run build`
  - `npm audit --audit-level=high`

## External Acceptance Still Required

- Run `marketbot agent -m "<finance question>"` with the intended production LLM provider.
- Run a live market-data request for representative US, HK, CN, and ETF symbols.
- Generate and save a real market report with `marketbot market report --save`.
- Start `marketbot gateway` with production config and verify graceful startup/shutdown.
- Send and receive at least one real message per enabled chat channel.
- Verify scheduled heartbeat or cron delivery in the target timezone.
- Confirm report artifacts, session files, and skill score updates are written to the intended workspace.

## Release Gate

Treat the automated checks as the merge gate. Treat the external acceptance items as
the pre-release gate for any environment that sends real investment analysis to users.
