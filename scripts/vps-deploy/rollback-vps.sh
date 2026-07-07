#!/usr/bin/env bash
# P10-3-N-003 — Idempotent VPS rollback to a known git SHA + four-process smoke
# Usage: ROLLBACK_SHA=<sha> DEPLOY_PATH=/opt/app-tour ENV_DIR=/etc/app-tour bash rollback-vps.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/app-tour}"
ENV_DIR="${ENV_DIR:-/etc/app-tour}"
APP_USER="${APP_USER:-app-tour}"
BRANCH="${DEPLOY_BRANCH:-main}"
TARGET_SHA="${ROLLBACK_SHA:-}"

log() { printf '[rollback-vps] %s\n' "$*"; }
die() { printf '[rollback-vps] ERROR: %s\n' "$*" >&2; exit 1; }

[[ -d "$DEPLOY_PATH/.git" ]] || die "repo missing at $DEPLOY_PATH"

if [[ -z "$TARGET_SHA" ]]; then
  if [[ -d "$DEPLOY_PATH/.git" ]]; then
    TARGET_SHA="$(cd "$DEPLOY_PATH" && git rev-parse "origin/${BRANCH}~1" 2>/dev/null || git rev-parse HEAD~1 2>/dev/null || true)"
  fi
fi
[[ -n "$TARGET_SHA" ]] || die "set ROLLBACK_SHA (staging rsync path may have no git parent)"

if [[ "${ROLLBACK_DRY_RUN:-}" == "1" ]]; then
  exec bash "$(dirname "$0")/rollback-vps-dry-run.sh"
fi

if [[ -z "${UNIT_PREFIX:-}" ]]; then
  if [[ "$ENV_DIR" == *staging* || "$DEPLOY_PATH" == *staging* ]]; then
    UNIT_PREFIX="app-tour-staging"
  else
    UNIT_PREFIX="app-tour"
  fi
fi

log "rollback $DEPLOY_PATH → ${TARGET_SHA}"
cd "$DEPLOY_PATH"
git fetch origin "$BRANCH"
git reset --hard "$TARGET_SHA"
chown -R "$APP_USER:$APP_USER" "$DEPLOY_PATH"

log "restart four processes"
systemctl restart "${UNIT_PREFIX}-api.service"
systemctl restart "${UNIT_PREFIX}-web.service"
if [[ -f "$ENV_DIR/marketing.env" ]]; then
  systemctl restart "${UNIT_PREFIX}-marketing.service"
fi
if [[ -f "$ENV_DIR/portal.env" ]]; then
  systemctl restart "${UNIT_PREFIX}-portal.service"
fi

if command -v systemctl >/dev/null 2>&1 && systemctl is-active caddy >/dev/null 2>&1; then
  systemctl reload caddy || systemctl restart caddy || true
fi

log "post-rollback smoke"
ENV_DIR="$ENV_DIR" bash "$DEPLOY_PATH/scripts/vps-deploy/smoke-four-process.sh"

log "rollback complete at $(git rev-parse --short HEAD)"
echo "ROLLBACK_VPS_OK"
