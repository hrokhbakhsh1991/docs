#!/usr/bin/env bash
# systemd ExecStart — Next standalone artifact (no pnpm).
set -euo pipefail

RELEASE_ROOT="${RELEASE_ROOT:-/opt/app-tour-staging/current}"
APP_KEY="${APP_KEY:?APP_KEY required (web|portal|marketing)}"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"

case "$APP_KEY" in
  web) app_rel="apps/web" ;;
  portal) app_rel="apps/portal" ;;
  marketing) app_rel="apps/marketing" ;;
  *)
    echo "start-next-artifact: unknown APP_KEY=$APP_KEY" >&2
    exit 1
    ;;
esac

runtime_json="${RELEASE_ROOT}/${APP_KEY}/RUNTIME.json"
[[ -f "$runtime_json" ]] || {
  echo "start-next-artifact: missing $runtime_json" >&2
  exit 1
}

server_js=$(python3 -c "import json;print(json.load(open('$runtime_json'))['serverJs'])")
bind_host="${WEB_BIND_HOST:-0.0.0.0}"

set -a
# shellcheck source=/dev/null
source "${ENV_DIR}/${APP_KEY}.env"
set +a

export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:?PORT missing in env}"
export HOSTNAME="$bind_host"

if [[ "$APP_KEY" == "portal" ]]; then
  portal_snapshot="${RELEASE_ROOT}/portal/apps/portal/src/me/member-profile-contract-v1.snapshot.json"
  if [[ -f "$portal_snapshot" ]]; then
    export MEMBER_PROFILE_CONTRACT_SNAPSHOT_PATH="$portal_snapshot"
  fi
fi

cd "${RELEASE_ROOT}/${APP_KEY}"
exec /usr/bin/node "$server_js"
