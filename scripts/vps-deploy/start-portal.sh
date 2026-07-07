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

WEB_BIND_HOST="${WEB_BIND_HOST:-0.0.0.0}"
exec /usr/local/bin/pnpm exec next start -p "${PORT:-3003}" -H "$WEB_BIND_HOST"
