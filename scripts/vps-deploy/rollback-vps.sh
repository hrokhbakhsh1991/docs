#!/usr/bin/env bash
# P10-3-N-003 / MR-P0-014 — VPS rollback: code SHA + optional DB restore
# Usage:
#   ROLLBACK_SHA=<sha> ROLLBACK_DB_DUMP=/path/to.dump \
#     DEPLOY_PATH=/opt/app-cloud ENV_DIR=/etc/app-cloud bash rollback-vps.sh
# Code-only (schema stays forward — explicit opt-in):
#   ROLLBACK_SHA=<sha> ROLLBACK_CODE_ONLY=1 bash rollback-vps.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/app-cloud}"
ENV_DIR="${ENV_DIR:-/etc/app-cloud}"
APP_USER="${APP_USER:-app-cloud}"
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

CODE_ONLY="${ROLLBACK_CODE_ONLY:-0}"
DB_DUMP="${ROLLBACK_DB_DUMP:-}"
if [[ "$CODE_ONLY" != "1" && -z "$DB_DUMP" ]]; then
  die "MR-P0-014/TODO-010: set ROLLBACK_DB_DUMP=/path/to.pre-migrate.dump (or ROLLBACK_CODE_ONLY=1 with I_ACCEPT_SCHEMA_FORWARD=1)"
fi
if [[ "$CODE_ONLY" == "1" ]]; then
  if [[ "${I_ACCEPT_SCHEMA_FORWARD:-}" != "1" ]]; then
    die "TODO-010: ROLLBACK_CODE_ONLY=1 also requires I_ACCEPT_SCHEMA_FORWARD=1 (schema stays forward)"
  fi
  log "WARNING: ROLLBACK_CODE_ONLY=1 + I_ACCEPT_SCHEMA_FORWARD=1 — git resets; Postgres schema/data stay at forward tip"
elif [[ ! -f "$DB_DUMP" ]]; then
  die "ROLLBACK_DB_DUMP not found: $DB_DUMP"
fi

if [[ -z "${UNIT_PREFIX:-}" ]]; then
  if [[ "$ENV_DIR" == *staging* || "$DEPLOY_PATH" == *staging* ]]; then
    UNIT_PREFIX="app-cloud-staging"
  else
    UNIT_PREFIX="app-cloud"
  fi
fi

log "stop API before rollback"
systemctl stop "${UNIT_PREFIX}-api.service" || true

if [[ "$CODE_ONLY" != "1" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_DIR}/api.env"
  set +a
  ADMIN_URL="${DATABASE_URL_ADMIN:-}"
  [[ -n "$ADMIN_URL" ]] || die "DATABASE_URL_ADMIN required to restore dump"
  log "restore DB from $DB_DUMP"
  pg_restore --clean --if-exists --no-owner --dbname="$ADMIN_URL" "$DB_DUMP" \
    || die "pg_restore failed — refuse code rollback with half-restored DB"
fi

log "rollback code $DEPLOY_PATH → ${TARGET_SHA}"
cd "$DEPLOY_PATH"
git fetch origin "$BRANCH"
git reset --hard "$TARGET_SHA"
chown -R "$APP_USER:$APP_USER" "$DEPLOY_PATH"

log "restart four processes"
systemctl start "${UNIT_PREFIX}-api.service"
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
