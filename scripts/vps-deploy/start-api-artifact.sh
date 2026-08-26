#!/usr/bin/env bash
# systemd ExecStart — API compiled artifact (no pnpm).
set -euo pipefail

RELEASE_ROOT="${RELEASE_ROOT:-/opt/app-tour-staging/current}"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"

cd "${RELEASE_ROOT}/api"
set -a
# shellcheck source=/dev/null
source "${ENV_DIR}/api.env"
set +a

[[ -f dist/main.js ]] || {
  echo "start-api-artifact: missing dist/main.js under ${RELEASE_ROOT}/api" >&2
  exit 1
}

exec /usr/bin/node dist/main.js
