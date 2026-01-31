#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="$HOME/.onedrive-mcp"
CREDS_FILE="$CONFIG_DIR/credentials.json"

need_bin() { command -v "$1" >/dev/null 2>&1 || { echo "Missing dependency: $1"; exit 1; }; }
need_bin curl
need_bin jq

if [[ ! -f "$CREDS_FILE" ]]; then
  echo "Missing credentials. Run: ./scripts/onedrive-setup.sh"
  exit 1
fi

ACCESS_TOKEN=$(jq -r '.access_token' "$CREDS_FILE" 2>/dev/null)
if [[ -z "$ACCESS_TOKEN" || "$ACCESS_TOKEN" == "null" ]]; then
  echo "No access_token. Run setup or refresh token."
  exit 1
fi

API="https://graph.microsoft.com/v1.0/me/drive"

urlencode() {
  python3 - <<PY
import urllib.parse,sys
print(urllib.parse.quote(sys.argv[1]))
PY
}

# Convert a human path like "/Folder/file.pdf" to the Graph colon path
# root:/{path}:
colon_path() {
  local p="$1"
  # normalize
  if [[ -z "$p" ]]; then p="/"; fi
  if [[ "$p" != /* ]]; then p="/$p"; fi
  if [[ "$p" == "/" ]]; then
    echo "root"
  else
    # encode each segment safely
    python3 - "$p" <<'PY'
import sys, urllib.parse
p=sys.argv[1]
segs=[s for s in p.split('/') if s]
enc='/'.join(urllib.parse.quote(s) for s in segs)
print(f"root:/{enc}:")
PY
  fi
}

cmd="${1:-}"
shift || true

case "$cmd" in
  ls)
    P="${1:-/}"
    CP=$(colon_path "$P")
    if [[ "$CP" == "root" ]]; then
      curl -sS "$API/root/children" -H "Authorization: Bearer $ACCESS_TOKEN" \
        | jq -r '.value[] | {name:.name, type:(if .folder then "folder" else "file" end), size:.size, id:.id} | @json'
    else
      curl -sS "$API/$CP/children" -H "Authorization: Bearer $ACCESS_TOKEN" \
        | jq -r '.value[] | {name:.name, type:(if .folder then "folder" else "file" end), size:.size, id:.id} | @json'
    fi
    ;;

  mkdir)
    P="${1:?Provide folder path, e.g. /Rechnungen Januar 2026}"
    # parent + leaf
    # Split into parent folder + leaf name (use python argv properly)
    readarray -t parts < <(python3 -c 'import os,sys
p=sys.argv[1]
if not p.startswith("/"):
  p="/"+p
print(os.path.dirname(p) or "/")
print(os.path.basename(p))
' "$P")
    PARENT="${parts[0]}"
    LEAF="${parts[1]}"

    CP=$(colon_path "$PARENT")
    endpoint="$API/root/children"
    if [[ "$CP" != "root" ]]; then
      endpoint="$API/$CP/children"
    fi

    curl -sS -X POST "$endpoint" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H 'Content-Type: application/json' \
      -d "{\"name\": \"$LEAF\", \"folder\": {}, \"@microsoft.graph.conflictBehavior\": \"rename\"}" \
      | jq '{id,name,webUrl,folder:.folder != null}'
    ;;

  upload)
    LOCAL="${1:?Provide local file path}"
    DEST="${2:?Provide destination path in OneDrive, e.g. /Folder/file.pdf}"
    if [[ ! -f "$LOCAL" ]]; then
      echo "Local file not found: $LOCAL"
      exit 1
    fi
    CP=$(colon_path "$DEST")
    if [[ "$CP" == "root" ]]; then
      echo "Destination must be a file path, not /."
      exit 1
    fi
    # PUT content
    curl -sS -X PUT "$API/$CP/content" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H 'Content-Type: application/octet-stream' \
      --data-binary "@$LOCAL" \
      | jq '{id,name,size,webUrl}'
    ;;

  download)
    SRC="${1:?Provide source path in OneDrive, e.g. /Folder/file.pdf}"
    OUT="${2:?Provide output file path}"
    CP=$(colon_path "$SRC")
    meta=$(curl -sS "$API/$CP" -H "Authorization: Bearer $ACCESS_TOKEN")
    dl=$(echo "$meta" | jq -r '."@microsoft.graph.downloadUrl" // empty')
    if [[ -z "$dl" ]]; then
      echo "Could not get download URL (maybe a folder?)"
      echo "$meta" | jq .
      exit 1
    fi
    curl -sS "$dl" -o "$OUT"
    echo "saved: $OUT"
    ;;

  info)
    P="${1:-/}"
    CP=$(colon_path "$P")
    curl -sS "$API/$CP" -H "Authorization: Bearer $ACCESS_TOKEN" | jq '{id,name,size,webUrl,folder,file}'
    ;;

  *)
    cat <<EOF
Usage:
  $0 ls [path]
  $0 mkdir <folderPath>
  $0 upload <localPath> <destPath>
  $0 download <srcPath> <outPath>
  $0 info [path]

Examples:
  $0 ls /
  $0 mkdir "/Rechnungen Januar 2026"
  $0 upload ./invoice.pdf "/Rechnungen Januar 2026/invoice.pdf"
  $0 download "/Rechnungen Januar 2026/invoice.pdf" ./invoice.pdf
EOF
    exit 1
    ;;
esac
