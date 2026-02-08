#!/bin/bash
set -euo pipefail

MODEL_NAME="qwen3:0.6b"
MODEL_ID="ollama/${MODEL_NAME}"
GATEWAY_URL="http://127.0.0.1:18789/"

if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama is not installed. Install from https://ollama.com or 'brew install ollama'."
  exit 1
fi

if ! curl -s http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  if [[ "${OSTYPE:-}" == "darwin"* ]] && command -v brew >/dev/null 2>&1; then
    brew services start ollama >/dev/null 2>&1 || true
  fi
  nohup ollama serve >/tmp/ollama.log 2>&1 &
  sleep 3
fi

ollama pull "${MODEL_NAME}"

pnpm -s marketbot config set gateway.mode local
pnpm -s marketbot config set models.providers.ollama.apiKey "ollama-local"
pnpm -s marketbot config set agents.defaults.model.primary "${MODEL_ID}"

if [[ "${1:-}" == "--no-open" ]]; then
  exec pnpm -s marketbot gateway run --bind loopback --port 18789 --force
fi

pnpm -s marketbot gateway run --bind loopback --port 18789 --force &
GATEWAY_PID=$!

sleep 2
if command -v open >/dev/null 2>&1; then
  open "${GATEWAY_URL}" || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "${GATEWAY_URL}" || true
fi

wait "${GATEWAY_PID}"
