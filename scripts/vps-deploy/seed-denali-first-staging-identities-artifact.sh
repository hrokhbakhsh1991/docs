#!/usr/bin/env bash
# Run only from a bundled staging release; the seed program enforces the A-side target.
set -euo pipefail

RELEASE_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
ENV_FILE="/etc/app-tour-staging/api.env"
MODE=""

if [[ "$#" -gt 1 ]]; then
  echo "Usage: seed-denali-first-staging-identities.sh [--apply]" >&2
  exit 1
fi
if [[ "${1:-}" == "--apply" ]]; then
  MODE="--apply"
elif [[ -n "${1:-}" ]]; then
  echo "Usage: seed-denali-first-staging-identities.sh [--apply]" >&2
  exit 1
fi

[[ -f "$ENV_FILE" ]] || {
  echo "first-staging-identities: staging API environment file is missing" >&2
  exit 1
}
[[ "$RELEASE_ROOT" == /opt/app-tour-staging/releases/* ]] || {
  echo "first-staging-identities: release is outside /opt/app-tour-staging/releases" >&2
  exit 1
}
[[ -f "${RELEASE_ROOT}/bin/seed-denali-first-staging-identities.cjs" ]] || {
  echo "first-staging-identities: bundled A-side identities seed is missing" >&2
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
  exec node "${RELEASE_ROOT}/bin/seed-denali-first-staging-identities.cjs" --apply
fi
exec node "${RELEASE_ROOT}/bin/seed-denali-first-staging-identities.cjs"
