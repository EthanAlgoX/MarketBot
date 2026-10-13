#!/usr/bin/env bash
# Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
# Build and roll out origin/main on the single-VM production stack.
#
# Install as /usr/local/sbin/marketbot-deploy-main and run it as the deploy user, for example
# from CI through an SSH forced command. The deploy user needs passwordless sudo for Docker.
set -Eeuo pipefail

# A forced SSH command carries no environment, so read the checkout path from a root-owned file.
if [[ -z "${MARKETBOT_DEPLOY_DIR:-}" && -r /etc/marketbot/deploy.env ]]; then
  # shellcheck disable=SC1091
  source /etc/marketbot/deploy.env
fi
APP_DIR="${MARKETBOT_DEPLOY_DIR:-/srv/marketbot}"
[[ "${APP_DIR}" == /* ]] || { echo "MARKETBOT_DEPLOY_DIR must be an absolute path" >&2; exit 1; }
COMPOSE_FILE="infra/compose/docker-compose.prod.yml"
# CI allows 30 minutes: 15m build + 5m start + ~1m of health retries + 8m rollback.
BUILD_TIMEOUT="${MARKETBOT_DEPLOY_BUILD_TIMEOUT:-15m}"
UP_TIMEOUT="${MARKETBOT_DEPLOY_UP_TIMEOUT:-5m}"
ROLLBACK_TIMEOUT="${MARKETBOT_DEPLOY_ROLLBACK_TIMEOUT:-8m}"

cd "${APP_DIR}"
if [[ -z "${MARKETBOT_HEALTH_URL:-}" ]]; then
  host="$(sed -n 's/^MARKETBOT_HOST=//p' .env | tail -n 1)"
  [[ -n "${host}" ]] || { echo "Set MARKETBOT_HOST in .env or MARKETBOT_HEALTH_URL" >&2; exit 1; }
  MARKETBOT_HEALTH_URL="https://${host}/health"
fi

compose() {
  local limit="$1"
  shift
  timeout --kill-after=30s "${limit}" sudo docker compose --env-file .env -f "${COMPOSE_FILE}" "$@"
}

healthy() {
  curl --fail --silent --show-error --max-time 15 "${MARKETBOT_HEALTH_URL}" >/dev/null
}

exec 9>"${APP_DIR}/.deploy.lock"
if ! flock -n 9; then
  # CI runs one deploy at a time, so a held lock means an earlier deploy is stuck. Fail loudly
  # instead of reporting a deploy that never happened.
  echo "Another production deployment holds the lock; refusing to report success." >&2
  exit 1
fi

previous_revision="$(git rev-parse HEAD)"
git fetch --quiet --prune origin main
target_revision="$(git rev-parse origin/main)"

# Written only after a healthy rollout. A reset can make HEAD match before containers change.
deployed_revision=""
if [[ -r "${APP_DIR}/.last-deployed-revision" ]]; then
  deployed_revision="$(tr -d '[:space:]' <"${APP_DIR}/.last-deployed-revision")"
fi
if [[ "${previous_revision}" == "${target_revision}" && "${deployed_revision}" == "${target_revision}" ]] && healthy; then
  echo "Production is already at ${target_revision} and healthy."
  exit 0
fi

rollback() {
  trap - ERR
  echo "Deployment failed; restoring the previous revision ${previous_revision}." >&2
  git reset --hard "${previous_revision}"
  compose "${ROLLBACK_TIMEOUT}" up -d --build --remove-orphans
  exit 1
}
trap rollback ERR

git reset --hard "${target_revision}"
compose 1m config --quiet
compose "${BUILD_TIMEOUT}" build
compose "${UP_TIMEOUT}" up -d --remove-orphans

for _ in {1..30}; do
  if healthy; then
    printf '%s\n' "${target_revision}" >"${APP_DIR}/.last-deployed-revision"
    trap - ERR
    echo "Deployed ${target_revision} successfully."
    exit 0
  fi
  sleep "${MARKETBOT_DEPLOY_HEALTH_INTERVAL:-2}"
done

echo "Production health check did not recover in time." >&2
false
