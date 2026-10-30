#!/usr/bin/env bash
# Run only from a bundled staging release; the seed program enforces the DB target.
set -euo pipefail

RELEASE_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
MANIFEST_ROOT="/etc/app-tour-staging"
ENV_FILE="/etc/app-tour-staging/api.env"
MANIFEST_DIR="${MANIFEST_ROOT}/denali-first-staging-draft-tour-manifests"
MODE=""

if [[ "$#" -lt 2 || "$#" -gt 3 || "$1" != "--run-id" ]]; then
  echo "Usage: seed-denali-first-staging-draft-tour.sh --run-id <run-id> [--apply]" >&2
  exit 1
fi
RUN_ID="$2"
[[ "$RUN_ID" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$ ]] || {
  echo "first-staging-draft-tour: invalid run ID" >&2
  exit 1
}
if [[ "${3:-}" == "--apply" ]]; then
  MODE="--apply"
elif [[ -n "${3:-}" ]]; then
  echo "Usage: seed-denali-first-staging-draft-tour.sh --run-id <run-id> [--apply]" >&2
  exit 1
fi

[[ -f "$ENV_FILE" ]] || {
  echo "first-staging-draft-tour: staging API environment file is missing" >&2
  exit 1
}
[[ "$RELEASE_ROOT" == /opt/app-tour-staging/releases/* ]] || {
  echo "first-staging-draft-tour: release is outside /opt/app-tour-staging/releases" >&2
  exit 1
}
[[ -f "${RELEASE_ROOT}/bin/seed-denali-first-staging-draft-tour.cjs" ]] || {
  echo "first-staging-draft-tour: bundled seed is missing" >&2
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
  umask 077
  [[ "$(realpath -e "$MANIFEST_ROOT")" == "$MANIFEST_ROOT" ]] || {
    echo "first-staging-draft-tour: staging manifest root is not canonical" >&2
    exit 1
  }
  [[ ! -L "$MANIFEST_DIR" ]] || {
    echo "first-staging-draft-tour: manifest directory must not be a symlink" >&2
    exit 1
  }
  mkdir -p -m 0700 "$MANIFEST_DIR"
  [[ "$(realpath -e "$MANIFEST_DIR")" == "$MANIFEST_DIR" ]] || {
    echo "first-staging-draft-tour: manifest directory resolves outside its staging path" >&2
    exit 1
  }
  chmod 0700 "$MANIFEST_DIR"
  MANIFEST_PATH="${MANIFEST_DIR}/${RUN_ID}.json"
  LOCK_PATH="${MANIFEST_DIR}/.${RUN_ID}.lock"
  exec 9>"$LOCK_PATH"
  flock -x 9
  EXPECTED_MANIFEST="$(mktemp "${MANIFEST_DIR}/.${RUN_ID}.expected.XXXXXX")"
  TEMP_MANIFEST="$(mktemp "${MANIFEST_DIR}/.${RUN_ID}.XXXXXX")"
  trap 'rm -f -- "$EXPECTED_MANIFEST" "$TEMP_MANIFEST"' EXIT
  node "${RELEASE_ROOT}/bin/seed-denali-first-staging-draft-tour.cjs" --run-id "$RUN_ID" --manifest-only >"$EXPECTED_MANIFEST"
  chmod 0600 "$EXPECTED_MANIFEST"
  if [[ -e "$MANIFEST_PATH" ]]; then
    cmp -s "$EXPECTED_MANIFEST" "$MANIFEST_PATH" || {
      echo "first-staging-draft-tour: existing run manifest differs" >&2
      exit 1
    }
  else
    mv -- "$EXPECTED_MANIFEST" "$MANIFEST_PATH"
  fi
  node "${RELEASE_ROOT}/bin/seed-denali-first-staging-draft-tour.cjs" --run-id "$RUN_ID" --apply >"$TEMP_MANIFEST"
  chmod 0600 "$TEMP_MANIFEST"
  cmp -s "$TEMP_MANIFEST" "$MANIFEST_PATH" || {
    echo "first-staging-draft-tour: apply result differs from the preflight manifest" >&2
    exit 1
  }
  rm -f -- "$EXPECTED_MANIFEST" "$TEMP_MANIFEST"
  trap - EXIT
  cat "$MANIFEST_PATH"
  echo "first-staging-draft-tour: manifest saved at $MANIFEST_PATH" >&2
  exit 0
fi
exec node "${RELEASE_ROOT}/bin/seed-denali-first-staging-draft-tour.cjs" --run-id "$RUN_ID"
