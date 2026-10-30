#!/usr/bin/env bash
# Remove only the exact run-scoped A draft tour after dependency checks.
set -euo pipefail

RELEASE_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
ENV_FILE="/etc/app-tour-staging/api.env"
MANIFEST_DIR="/etc/app-tour-staging/denali-first-staging-draft-tour-manifests"
MODE=""

if [[ "$#" -lt 4 || "$#" -gt 5 || "$1" != "--run-id" || "$3" != "--manifest" ]]; then
  echo "Usage: cleanup-denali-first-staging-draft-tour.sh --run-id <run-id> --manifest <manifest.json> [--apply]" >&2
  exit 1
fi
RUN_ID="$2"
[[ "$RUN_ID" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$ ]] || {
  echo "first-staging-draft-tour-cleanup: invalid run ID" >&2
  exit 1
}
MANIFEST_PATH="$4"
if [[ "${5:-}" == "--apply" ]]; then
  MODE="--apply"
elif [[ -n "${5:-}" ]]; then
  echo "Usage: cleanup-denali-first-staging-draft-tour.sh --run-id <run-id> --manifest <manifest.json> [--apply]" >&2
  exit 1
fi

[[ -f "$ENV_FILE" ]] || {
  echo "first-staging-draft-tour-cleanup: staging API environment file is missing" >&2
  exit 1
}
[[ -d "$MANIFEST_DIR" && -f "$MANIFEST_PATH" ]] || {
  echo "first-staging-draft-tour-cleanup: saved manifest is missing" >&2
  exit 1
}
RELEASE_ROOT_REAL="$(realpath -e "$RELEASE_ROOT")"
MANIFEST_DIR_REAL="$(realpath -e "$MANIFEST_DIR")"
MANIFEST_PATH_REAL="$(realpath -e "$MANIFEST_PATH")"
[[ "$RELEASE_ROOT_REAL" == /opt/app-tour-staging/releases/* ]] || {
  echo "first-staging-draft-tour-cleanup: release is outside /opt/app-tour-staging/releases" >&2
  exit 1
}
[[ "$MANIFEST_DIR_REAL" == "$MANIFEST_DIR" ]] || {
  echo "first-staging-draft-tour-cleanup: manifest directory resolves outside its staging path" >&2
  exit 1
}
[[ "$MANIFEST_PATH_REAL" == "$MANIFEST_DIR_REAL/"* ]] || {
  echo "first-staging-draft-tour-cleanup: manifest is outside the staging manifest directory" >&2
  exit 1
}
[[ -f "${RELEASE_ROOT}/bin/cleanup-denali-first-staging-draft-tour.cjs" ]] || {
  echo "first-staging-draft-tour-cleanup: bundled cleanup is missing" >&2
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
  exec node "${RELEASE_ROOT}/bin/cleanup-denali-first-staging-draft-tour.cjs" --run-id "$RUN_ID" --manifest "$MANIFEST_PATH_REAL" --apply
fi
exec node "${RELEASE_ROOT}/bin/cleanup-denali-first-staging-draft-tour.cjs" --run-id "$RUN_ID" --manifest "$MANIFEST_PATH_REAL"
