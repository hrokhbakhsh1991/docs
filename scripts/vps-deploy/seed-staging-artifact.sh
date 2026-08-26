#!/usr/bin/env bash
# Run bundled staging seed against tour_db_staging (artifact release only).
set -euo pipefail

RELEASE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${1:-/etc/app-tour-staging/api.env}"

[[ -f "${RELEASE_ROOT}/bin/seed-staging.cjs" ]] || {
  echo "seed-staging: missing ${RELEASE_ROOT}/bin/seed-staging.cjs" >&2
  exit 1
}

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a
export DATABASE_URL="${DATABASE_URL_ADMIN:-$DATABASE_URL}"
export NODE_ENV=development

cd "${RELEASE_ROOT}/api"
PNPM_ROOT="${RELEASE_ROOT}/api/node_modules/.pnpm"
if [[ -d "${PNPM_ROOT}" ]]; then
  NODE_PATH="$(/usr/bin/find "${PNPM_ROOT}" -mindepth 2 -maxdepth 2 -type d -name node_modules 2>/dev/null | /usr/bin/tr '\n' ':' | /usr/bin/sed 's/:$//')"
  export NODE_PATH
fi
exec node "${RELEASE_ROOT}/bin/seed-staging.cjs"
