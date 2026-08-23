#!/usr/bin/env bash
# PROD-8 R8-12 — activate a pre-built immutable release via atomic symlink switch.
# Usage:
#   RELEASE_SHA=<40-char> DEPLOY_ROOT=/srv/app-tour bash activate-immutable-release.sh
set -euo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/srv/app-tour}"
RELEASE_SHA="${RELEASE_SHA:-}"
RELEASES_DIR="${RELEASES_DIR:-${DEPLOY_ROOT}/releases}"
CURRENT_LINK="${CURRENT_LINK:-${DEPLOY_ROOT}/current}"

log() { printf '[activate-immutable] %s\n' "$*"; }
die() { printf '[activate-immutable] ERROR: %s\n' "$*" >&2; exit 1; }

[[ -n "$RELEASE_SHA" ]] || die "RELEASE_SHA required"
TARGET="${RELEASES_DIR}/${RELEASE_SHA}"
[[ -d "$TARGET" ]] || die "release directory missing: $TARGET"
[[ -f "$TARGET/apps/api/dist/main.js" ]] || die "release missing apps/api/dist/main.js"

PREVIOUS_SHA=""
if [[ -L "$CURRENT_LINK" ]]; then
  PREVIOUS_SHA="$(readlink -f "$CURRENT_LINK" | xargs basename)"
fi

log "atomic switch $CURRENT_LINK -> $TARGET (previous=${PREVIOUS_SHA:-none})"
ln -sfn "$TARGET" "$CURRENT_LINK"
echo "$RELEASE_SHA" > "${DEPLOY_ROOT}/.active-release-sha"
echo "${PREVIOUS_SHA:-}" > "${DEPLOY_ROOT}/.previous-release-sha"
log "ACTIVE_RELEASE_SHA=$RELEASE_SHA"
echo "ACTIVATE_IMMUTABLE_RELEASE_OK"
