#!/usr/bin/env bash
# systemd ExecStart — production API must run compiled dist (MR-P0-013).
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/app-cloud}"
ENV_DIR="${ENV_DIR:-/etc/app-cloud}"

cd "${DEPLOY_PATH}/apps/api"
set -a
# shellcheck source=/dev/null
source "${ENV_DIR}/api.env"
set +a

if [[ ! -f dist/main.js ]]; then
  echo "[start-api] ERROR: dist/main.js missing — refuse tsx fallback in production (MR-P0-013)" >&2
  exit 1
fi

exec node dist/main.js
