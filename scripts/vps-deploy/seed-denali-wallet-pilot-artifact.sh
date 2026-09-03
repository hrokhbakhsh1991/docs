#!/usr/bin/env bash
# Run bundled Denali Wallet pilot seed on a confirmed staging artifact release.
set -euo pipefail

RELEASE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-/etc/app-tour-staging/api.env}"

[[ -f "${RELEASE_ROOT}/bin/seed-denali-wallet-pilot.cjs" ]] || {
  echo "seed-denali-wallet-pilot: missing bundled seed" >&2
  exit 1
}

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

export DATABASE_URL="${DATABASE_URL_ADMIN:-$DATABASE_URL}"
export NODE_ENV="${NODE_ENV:-development}"
export STORAGE_DRIVER=prisma

cd "${RELEASE_ROOT}/api"
exec node "${RELEASE_ROOT}/bin/seed-denali-wallet-pilot.cjs"
