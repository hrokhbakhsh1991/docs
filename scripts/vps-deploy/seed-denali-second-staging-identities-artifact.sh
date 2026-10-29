#!/usr/bin/env bash
# Run only from a bundled staging release; the seed program enforces the DB target.
set -euo pipefail

RELEASE_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
ENV_FILE="/etc/app-tour-staging/api.env"
MODE=""

if [[ "$#" -gt 2 ]]; then
  echo "Usage: seed-denali-second-staging-identities.sh [--apply]" >&2
  exit 1
fi

if [[ "${1:-}" == "--apply" ]]; then
  [[ "$#" -eq 1 ]] || {
    echo "Usage: seed-denali-second-staging-identities.sh [--apply]" >&2
    exit 1
  }
  MODE="--apply"
elif [[ -n "${1:-}" ]]; then
  ENV_FILE="$1"
  MODE="${2:-}"
fi

[[ "$ENV_FILE" == "/etc/app-tour-staging/api.env" ]] || {
  echo "second-staging-identities: only /etc/app-tour-staging/api.env is allowed" >&2
  exit 1
}
[[ -f "$ENV_FILE" ]] || {
  echo "second-staging-identities: staging API environment file is missing" >&2
  exit 1
}
[[ "$RELEASE_ROOT" == /opt/app-tour-staging/releases/* ]] || {
  echo "second-staging-identities: release is outside /opt/app-tour-staging/releases" >&2
  exit 1
}
[[ -f "${RELEASE_ROOT}/bin/seed-denali-second-staging-identities.cjs" ]] || {
  echo "second-staging-identities: bundled identity seed is missing" >&2
  exit 1
}
[[ -z "$MODE" || "$MODE" == "--apply" ]] || {
  echo "Usage: seed-denali-second-staging-identities.sh [--apply]" >&2
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
  exec node "${RELEASE_ROOT}/bin/seed-denali-second-staging-identities.cjs" --apply
fi
exec node "${RELEASE_ROOT}/bin/seed-denali-second-staging-identities.cjs"
