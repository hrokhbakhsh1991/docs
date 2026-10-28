#!/usr/bin/env bash
# Run only from a bundled staging release; the seed program enforces the DB target.
set -euo pipefail

RELEASE_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
ENV_FILE="/etc/app-tour-staging/api.env"
MODE=""

if [[ "$#" -lt 2 || "$#" -gt 3 || "$1" != "--run-id" ]]; then
  echo "Usage: seed-denali-second-staging-fixtures.sh --run-id <run-id> [--apply]" >&2
  exit 1
fi
RUN_ID="$2"
if [[ "${3:-}" == "--apply" ]]; then
  MODE="--apply"
elif [[ -n "${3:-}" ]]; then
  echo "Usage: seed-denali-second-staging-fixtures.sh --run-id <run-id> [--apply]" >&2
  exit 1
fi

[[ -f "$ENV_FILE" ]] || {
  echo "second-staging-fixtures: staging API environment file is missing" >&2
  exit 1
}
[[ "$RELEASE_ROOT" == /opt/app-tour-staging/releases/* ]] || {
  echo "second-staging-fixtures: release is outside /opt/app-tour-staging/releases" >&2
  exit 1
}
[[ -f "${RELEASE_ROOT}/bin/seed-denali-second-staging-fixtures.cjs" ]] || {
  echo "second-staging-fixtures: bundled fixtures seed is missing" >&2
  exit 1
}

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

export ENV_DIR="/etc/app-tour-staging"
export DEPLOY_ROOT="/opt/app-tour-staging"
export STORAGE_DRIVER="prisma"
ARTIFACT_NODE_MODULES="${RELEASE_ROOT}/api/node_modules"
ARTIFACT_PNPM_NODE_MODULES="${ARTIFACT_NODE_MODULES}/.pnpm/node_modules"
export NODE_PATH="${ARTIFACT_NODE_MODULES}:${ARTIFACT_PNPM_NODE_MODULES}${NODE_PATH:+:${NODE_PATH}}"

cd "${RELEASE_ROOT}/api"
if [[ "$MODE" == "--apply" ]]; then
  exec node "${RELEASE_ROOT}/bin/seed-denali-second-staging-fixtures.cjs" --run-id "$RUN_ID" --apply
fi
exec node "${RELEASE_ROOT}/bin/seed-denali-second-staging-fixtures.cjs" --run-id "$RUN_ID"
