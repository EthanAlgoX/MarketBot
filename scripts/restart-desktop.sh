#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PATH="${ROOT_DIR}/apps/desktop/release/mac-arm64/MarketBot Desktop.app"
APP_BIN_PATTERN="MarketBot Desktop.app/Contents/MacOS/MarketBot Desktop"

if [[ ! -d "${APP_PATH}" ]]; then
  echo "ERROR: Desktop app not found at ${APP_PATH}" >&2
  echo "Build/package it first: pnpm --dir apps/desktop package:mac" >&2
  exit 1
fi

# Graceful stop first; force kill only if still alive.
pkill -f "${APP_BIN_PATTERN}" 2>/dev/null || true
sleep 1
if pgrep -f "${APP_BIN_PATTERN}" >/dev/null 2>&1; then
  pkill -9 -f "${APP_BIN_PATTERN}" 2>/dev/null || true
  sleep 1
fi

open "${APP_PATH}"
sleep 2

if pgrep -f "${APP_BIN_PATTERN}" >/dev/null 2>&1; then
  echo "OK: MarketBot Desktop restarted."
else
  echo "ERROR: MarketBot Desktop failed to start." >&2
  exit 1
fi
