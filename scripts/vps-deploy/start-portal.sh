#!/usr/bin/env bash
# systemd ExecStart — Next.js production server for @apps/portal.
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/app-tour}"
ENV_DIR="${ENV_DIR:-/etc/app-tour}"

cd "${DEPLOY_PATH}/apps/portal"
set -a
# shellcheck source=/dev/null
source "${ENV_DIR}/portal.env"
set +a

portal_snapshot="${DEPLOY_PATH}/apps/portal/src/me/member-profile-contract-v1.snapshot.json"
if [[ -f "$portal_snapshot" ]]; then
  export MEMBER_PROFILE_CONTRACT_SNAPSHOT_PATH="$portal_snapshot"
fi

WEB_BIND_HOST="${WEB_BIND_HOST:-0.0.0.0}"
exec /usr/local/bin/pnpm exec next start -p "${PORT:-3003}" -H "$WEB_BIND_HOST"
