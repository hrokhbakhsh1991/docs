#!/usr/bin/env bash
# systemd ExecStart — API runtime (tsx) until @apps/api production tsc is green.
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/app-tour}"
ENV_DIR="${ENV_DIR:-/etc/app-tour}"

cd "${DEPLOY_PATH}/apps/api"
set -a
# shellcheck source=/dev/null
source "${ENV_DIR}/api.env"
set +a

if [[ -f dist/main.js ]]; then
  exec node dist/main.js
fi

echo "[start-api] dist/main.js missing — falling back to tsx runtime" >&2
exec node --import tsx src/main.ts
