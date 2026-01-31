#!/usr/bin/env bash
set -euo pipefail

q=${1:-}
if [[ -z "$q" ]]; then
  echo "usage: $0 <query>" >&2
  exit 2
fi

# Search curated + daily memory. Keep it simple and predictable.
# -n: line numbers, -I: ignore binary, -S: treat as text
# Exclude common noise dirs.

grep -RInI --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=dist \
  -- "${q}" \
  "./MEMORY.md" "./memory" 2>/dev/null || true
