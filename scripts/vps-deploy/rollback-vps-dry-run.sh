#!/usr/bin/env bash
# P10-3-N-003 — dry-run / verify rollback path without git reset
# Usage: ROLLBACK_DRY_RUN=1 DEPLOY_PATH=... ENV_DIR=... bash rollback-vps.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/app-tour}"
ENV_DIR="${ENV_DIR:-/etc/app-tour}"
BRANCH="${DEPLOY_BRANCH:-main}"
TARGET_SHA="${ROLLBACK_SHA:-}"

log() { printf '[rollback-vps] %s\n' "$*"; }

[[ -d "$DEPLOY_PATH/.git" ]] || {
  echo "[rollback-vps] ERROR: repo missing at $DEPLOY_PATH" >&2
  exit 1
}

if [[ -z "$TARGET_SHA" ]]; then
  if [[ -d "$DEPLOY_PATH/.git" ]]; then
    TARGET_SHA="$(cd "$DEPLOY_PATH" && git rev-parse 'HEAD~1' 2>/dev/null || true)"
    if [[ -z "$TARGET_SHA" ]]; then
      TARGET_SHA="$(cd "$DEPLOY_PATH" && git rev-parse "origin/${BRANCH}^" 2>/dev/null || true)"
    fi
  fi
fi
if [[ -z "$TARGET_SHA" ]]; then
  TARGET_SHA="<set ROLLBACK_SHA — rsync deploy may have no git parent>"
fi

CURRENT="unknown"
if [[ -d "$DEPLOY_PATH/.git" ]]; then
  CURRENT="$(cd "$DEPLOY_PATH" && git rev-parse --short HEAD 2>/dev/null || echo unknown)"
fi
log "DRY RUN — current=${CURRENT} target=${TARGET_SHA}"
log "would: git reset --hard ${TARGET_SHA}"
log "would: restart four-process units + reload caddy"
log "would: ENV_DIR=${ENV_DIR} smoke-four-process.sh"
echo "ROLLBACK_VPS_DRY_RUN_OK"
exit 0
