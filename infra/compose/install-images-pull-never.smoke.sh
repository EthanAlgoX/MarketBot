#!/usr/bin/env bash
# Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
set -euo pipefail
root="$(cd "$(dirname "$0")" && pwd)"
src="$root/install-images.sh"
fail() { echo "FAIL: $*" >&2; exit 1; }
# BSD grep needs -e so patterns starting with -- are not flags.
g() { grep -F -e "$1" "$src" >/dev/null || fail "missing $1"; }
g '--pull-never)'
g '--offline)'
g 'MARKETBOT_PULL_NEVER'
g 'Skipping image pull'
g '--pull never'
g 'cannot enforce pull-never on this Compose version'
g '${up_pull_args[@]+"${up_pull_args[@]}"}'
g 'HTTP_PROXY/HTTPS_PROXY'
g '[--prepare-only] [--local] [--pull-never] [--offline]'
set +e
out="$(bash "$src" --not-a-flag 2>&1)"
code=$?
set -e
[[ "$code" -eq 2 ]] || fail "expected exit 2 for unknown flag, got $code"
[[ "$out" == *"Usage: bash install-images.sh"* ]] || fail "usage missing from stderr"
bash -n "$src" || fail "bash -n failed"

tmp="$(mktemp -d "${TMPDIR:-/tmp}/install-images-smoke.XXXXXX")"
cleanup_tmp() { rm -rf "$tmp"; }
trap cleanup_tmp EXIT

write_stubs() {
  local bin="$1"
  mkdir -p "$bin"
  cat > "$bin/docker" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
log="${STUB_DOCKER_LOG:?}"
{
  printf 'docker'
  for a in "$@"; do
    printf ' %s' "$a"
  done
  printf '\n'
} >> "$log"

if [[ "${1:-}" != compose ]]; then
  echo "STUB: unexpected docker $*" >&2
  exit 1
fi
shift

help=false
short=false
verb=""
for a in "$@"; do
  case "$a" in
    --help|-h) help=true ;;
    --short) short=true ;;
    version|up|pull|config)
      if [[ -z "$verb" ]]; then
        verb="$a"
      fi
      ;;
  esac
done

echo "VERB=${verb:-none}" >> "$log"

if [[ "$verb" == config ]]; then
  cat >/dev/null || true
fi

if [[ "$help" == true ]]; then
  printf '%s\n' "${STUB_COMPOSE_UP_HELP:-Usage: docker compose up

Options:
  --pull string     Pull image before running
  --wait
  --wait-timeout int
}"
  exit 0
fi

case "$verb" in
  version)
    if [[ "$short" == true ]]; then
      printf '%s\n' "${STUB_COMPOSE_SHORT:-2.24.0}"
    else
      echo "Docker Compose version v${STUB_COMPOSE_SHORT:-2.24.0}"
    fi
    ;;
  config)
    cat <<'EOF'
POSTGRES_PASSWORD=test-postgres
BETTER_AUTH_SECRET=test-auth-secret
ENCRYPTION_KEY=test-encryption-key
SCREEN_PROXY_SECRET=test-screen-secret
SANDBOX_SUPERVISOR_TOKEN=test-supervisor-token
EOF
    printf 'MARKETBOT_IMAGE=%s\n' "${STUB_IMAGE-registry.example/financial-assistant/app}"
    printf 'MARKETBOT_COMPUTER_IMAGE=%s\n' "${STUB_COMPUTER_IMAGE-registry.example/financial-assistant/computer}"
    ;;
  pull|up)
    ;;
  *)
    echo "STUB: unexpected compose verb ${verb:-none} $*" >&2
    exit 1
    ;;
esac
STUB
  cat > "$bin/curl" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
log="${STUB_CURL_LOG:?}"
{
  printf 'curl'
  for a in "$@"; do
    printf ' %s' "$a"
  done
  printf '\n'
} >> "$log"
if [[ " $* " == *" --help "* ]]; then
  echo "--retry-all-errors"
  exit 0
fi
out=""
prev=""
for a in "$@"; do
  if [[ "$prev" == "-o" ]]; then
    out="$a"
  fi
  prev="$a"
done
if [[ -n "$out" ]]; then
  printf 'stub-download\n' > "$out"
  exit 0
fi
exit 1
STUB
  chmod +x "$bin/docker" "$bin/curl"
}

setup_work() {
  local work="$1"
  mkdir -p "$work/cwd"
  write_stubs "$work/bin"
  : > "$work/cwd/docker-compose.images.yml"
  : > "$work/cwd/.env.images.example"
  cat > "$work/cwd/.env" <<'EOF'
POSTGRES_PASSWORD=test-postgres
BETTER_AUTH_SECRET=test-auth-secret
ENCRYPTION_KEY=test-encryption-key
SCREEN_PROXY_SECRET=test-screen-secret
SANDBOX_SUPERVISOR_TOKEN=test-supervisor-token
MARKETBOT_IMAGE=registry.example/financial-assistant/app
MARKETBOT_COMPUTER_IMAGE=registry.example/financial-assistant/computer
EOF
  : > "$work/docker.log"
  : > "$work/curl.log"
}

run_install() {
  local work="$1"
  shift
  (
    export STUB_DOCKER_LOG="$work/docker.log"
    export STUB_CURL_LOG="$work/curl.log"
    export PATH="$work/bin:$PATH"
    export MARKETBOT_DOWNLOAD_BASE="https://releases.example/financial-assistant"
    cd "$work/cwd"
    bash "$src" "$@"
  )
}

has_compose_pull() {
  grep -q 'VERB=pull' "$1/docker.log"
}

has_up_pull_never() {
  grep -F -e 'VERB=up' "$1/docker.log" >/dev/null \
    && grep -F -e ' --pull never' "$1/docker.log" >/dev/null
}

# Flags accepted: --offline takes the local/pull-never path (no curl, no compose pull).
setup_work "$tmp/offline"
set +e
offline_out="$(run_install "$tmp/offline" --offline 2>&1)"
offline_code=$?
set -e
[[ "$offline_code" -eq 0 ]] || fail "--offline exited $offline_code: $offline_out"
[[ "$offline_out" != *"Usage: bash install-images.sh"* ]] || fail "--offline was rejected as unknown"
[[ "$offline_out" == *"Using local docker-compose.images.yml"* ]] || fail "--offline did not keep local compose file"
[[ "$offline_out" == *"Using local .env.images.example"* ]] || fail "--offline did not keep local env example"
[[ "$offline_out" == *"Skipping image pull"* ]] || fail "--offline did not skip image pull"
[[ "$offline_out" == *"MarketBot is starting"* ]] || fail "--offline did not start"
[[ ! -s "$tmp/offline/curl.log" ]] || fail "--offline should not curl when files are local: $(cat "$tmp/offline/curl.log")"
has_compose_pull "$tmp/offline" && fail "--offline should not run compose pull"
has_up_pull_never "$tmp/offline" || fail "--offline should pass --pull never to compose up: $(cat "$tmp/offline/docker.log")"

# --pull-never is accepted and skips pull (may still download Compose files).
setup_work "$tmp/pull-never"
set +e
pull_never_out="$(run_install "$tmp/pull-never" --pull-never 2>&1)"
pull_never_code=$?
set -e
[[ "$pull_never_code" -eq 0 ]] || fail "--pull-never exited $pull_never_code: $pull_never_out"
[[ "$pull_never_out" != *"Usage: bash install-images.sh"* ]] || fail "--pull-never was rejected as unknown"
[[ "$pull_never_out" == *"Skipping image pull"* ]] || fail "--pull-never did not skip image pull"
has_compose_pull "$tmp/pull-never" && fail "--pull-never should not run compose pull"
has_up_pull_never "$tmp/pull-never" || fail "--pull-never should pass --pull never to compose up"

# Offline mode fails closed if Compose cannot forbid implicit image pulls.
setup_work "$tmp/old"
export STUB_COMPOSE_UP_HELP='Usage: docker compose up
  --wait
  --wait-timeout int
'
set +e
old_out="$(run_install "$tmp/old" --offline 2>&1)"
old_code=$?
set -e
unset STUB_COMPOSE_UP_HELP
[[ "$old_code" -ne 0 ]] || fail "old Compose must fail when it cannot forbid pulls"
[[ "$old_out" == *"cannot enforce pull-never"* ]] || fail "old Compose refusal missing"
has_compose_pull "$tmp/old" && fail "old Compose --offline should not run compose pull"
if grep -F -e ' up -d' "$tmp/old/docker.log" >/dev/null; then
  fail "old Compose must not start after failing the pull-never guard"
fi

# Empty up arrays under set -u must not abort a normal install (bash 3.2).
setup_work "$tmp/default"
set +e
default_out="$(run_install "$tmp/default" 2>&1)"
default_code=$?
set -e
[[ "$default_code" -eq 0 ]] || fail "default install exited $default_code: $default_out"
[[ "$default_out" != *"unbound variable"* ]] || fail "empty array expansion aborted: $default_out"
has_compose_pull "$tmp/default" || fail "default install should run compose pull"
grep -q 'VERB=up' "$tmp/default/docker.log" || fail "default install should run compose up"

echo "ok"

# Unconfigured download channel refuses before curl or image pulls.
setup_work "$tmp/unconfigured"
set +e
unconfigured_out="$(
  cd "$tmp/unconfigured/cwd"
  unset MARKETBOT_DOWNLOAD_BASE
  export STUB_DOCKER_LOG="$tmp/unconfigured/docker.log"
  export STUB_CURL_LOG="$tmp/unconfigured/curl.log"
  export PATH="$tmp/unconfigured/bin:$PATH"
  bash "$src" 2>&1
)"
unconfigured_code=$?
set -e
[[ "$unconfigured_code" -ne 0 ]] || fail "unconfigured download base must fail"
[[ "$unconfigured_out" == *"set MARKETBOT_DOWNLOAD_BASE"* ]] || fail "configuration guidance missing"
[[ ! -s "$tmp/unconfigured/curl.log" ]] || fail "unconfigured install must not curl"
has_compose_pull "$tmp/unconfigured" && fail "unconfigured install must not pull"

echo "ok"

# Explicit local/missing app names cannot enable registry pulls or startup.
for image_case in missing local; do
  setup_work "$tmp/registry-$image_case"
  if [[ "$image_case" == missing ]]; then export STUB_IMAGE=""; else export STUB_IMAGE="marketbot/app"; fi
  set +e
  registry_out="$(run_install "$tmp/registry-$image_case" --offline 2>&1)"
  registry_code=$?
  set -e
  unset STUB_IMAGE
  [[ "$registry_code" -ne 0 ]] || fail "$image_case image must fail before startup"
  [[ "$registry_out" == *"your own MARKETBOT_IMAGE"* ]] || fail "registry guidance missing"
  has_compose_pull "$tmp/registry-$image_case" && fail "invalid registry must not pull"
  if grep -F -e ' up -d' "$tmp/registry-$image_case/docker.log" >/dev/null; then
    fail "invalid registry must not start"
  fi
done

echo "ok"
