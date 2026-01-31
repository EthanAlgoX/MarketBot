#!/usr/bin/env bash
set -euo pipefail

cd /repo

export MARKETBOT_STATE_DIR="/tmp/marketbot-test"
export MARKETBOT_CONFIG_PATH="${MARKETBOT_STATE_DIR}/marketbot.json"

echo "==> Seed state"
mkdir -p "${MARKETBOT_STATE_DIR}/credentials"
mkdir -p "${MARKETBOT_STATE_DIR}/agents/main/sessions"
echo '{}' >"${MARKETBOT_CONFIG_PATH}"
echo 'creds' >"${MARKETBOT_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${MARKETBOT_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
pnpm marketbot reset --scope config+creds+sessions --yes --non-interactive

test ! -f "${MARKETBOT_CONFIG_PATH}"
test ! -d "${MARKETBOT_STATE_DIR}/credentials"
test ! -d "${MARKETBOT_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${MARKETBOT_STATE_DIR}/credentials"
echo '{}' >"${MARKETBOT_CONFIG_PATH}"

echo "==> Uninstall (state only)"
pnpm marketbot uninstall --state --yes --non-interactive

test ! -d "${MARKETBOT_STATE_DIR}"

echo "OK"
