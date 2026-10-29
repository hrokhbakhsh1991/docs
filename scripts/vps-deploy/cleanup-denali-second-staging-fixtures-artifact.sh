#!/usr/bin/env bash
# Remove only exact, deterministic QA2 fixtures described by a seed manifest.
set -euo pipefail

RELEASE_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
ENV_FILE="/etc/app-tour-staging/api.env"
MANIFEST_DIR="/etc/app-tour-staging/denali-second-staging-manifests"
MODE=""

if [[ "$#" -lt 2 || "$#" -gt 3 || "$1" != "--manifest" ]]; then
  echo "Usage: cleanup-denali-second-staging-fixtures.sh --manifest <seed-manifest.json> [--apply]" >&2
  exit 1
fi
MANIFEST_PATH="$2"
if [[ "${3:-}" == "--apply" ]]; then
  MODE="--apply"
elif [[ -n "${3:-}" ]]; then
  echo "Usage: cleanup-denali-second-staging-fixtures.sh --manifest <seed-manifest.json> [--apply]" >&2
  exit 1
fi

[[ -f "$ENV_FILE" ]] || {
  echo "second-staging-cleanup: staging API environment file is missing" >&2
  exit 1
}
[[ -d "$MANIFEST_DIR" && -f "$MANIFEST_PATH" ]] || {
  echo "second-staging-cleanup: saved seed manifest or manifest directory is missing" >&2
  exit 1
}
RELEASE_ROOT_REAL="$(realpath -e "$RELEASE_ROOT")"
MANIFEST_DIR_REAL="$(realpath -e "$MANIFEST_DIR")"
MANIFEST_PATH_REAL="$(realpath -e "$MANIFEST_PATH")"
[[ "$RELEASE_ROOT_REAL" == /opt/app-tour-staging/releases/* ]] || {
  echo "second-staging-cleanup: release is outside /opt/app-tour-staging/releases" >&2
  exit 1
}
[[ "$MANIFEST_PATH_REAL" == "$MANIFEST_DIR_REAL/"* ]] || {
  echo "second-staging-cleanup: manifest is outside the staging manifest directory" >&2
  exit 1
}
[[ -f "${RELEASE_ROOT}/bin/cleanup-denali-second-staging-fixtures.cjs" ]] || {
  echo "second-staging-cleanup: bundled cleanup program is missing" >&2
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
  exec node "${RELEASE_ROOT}/bin/cleanup-denali-second-staging-fixtures.cjs" --manifest "$MANIFEST_PATH_REAL" --apply
fi
exec node "${RELEASE_ROOT}/bin/cleanup-denali-second-staging-fixtures.cjs" --manifest "$MANIFEST_PATH_REAL"
