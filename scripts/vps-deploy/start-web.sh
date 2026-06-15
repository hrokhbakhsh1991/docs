#!/usr/bin/env bash
# systemd ExecStart — Next.js production server for @apps/web.
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/app-tour}"
ENV_DIR="${ENV_DIR:-/etc/app-tour}"

cd "${DEPLOY_PATH}/apps/web"
set -a
# shellcheck source=/dev/null
source "${ENV_DIR}/web.env"
set +a

WEB_BIND_HOST="${WEB_BIND_HOST:-0.0.0.0}"
exec /usr/local/bin/pnpm exec next start -p "${PORT:-3000}" -H "$WEB_BIND_HOST"
