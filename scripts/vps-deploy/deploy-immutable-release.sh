#!/usr/bin/env bash
# PROD-8 R8-11..R8-17 — deploy pre-built immutable release (no pnpm install/build on server).
# Usage:
#   RELEASE_TARBALL=/path/to/prod8-bundle-<sha>.tar.gz \
#   DEPLOY_ROOT=/srv/app-tour ENV_DIR=/etc/app-tour \
#   bash deploy-immutable-release.sh
set -euo pipefail

DEPLOY_ROOT="${DEPLOY_ROOT:-/srv/app-tour}"
ENV_DIR="${ENV_DIR:-/etc/app-tour}"
APP_USER="${APP_USER:-app-tour}"
RELEASES_DIR="${RELEASES_DIR:-${DEPLOY_ROOT}/releases}"
RELEASE_TARBALL="${RELEASE_TARBALL:-}"
RELEASE_SHA="${RELEASE_SHA:-}"
UNIT_PREFIX="${UNIT_PREFIX:-app-tour}"
CURRENT_LINK="${CURRENT_LINK:-${DEPLOY_ROOT}/current}"

log() { printf '[deploy-immutable] %s\n' "$*"; }
die() { printf '[deploy-immutable] ERROR: %s\n' "$*" >&2; exit 1; }

[[ -f "${ENV_DIR}/api.env" ]] || die "missing ${ENV_DIR}/api.env"
[[ -n "$RELEASE_TARBALL" || -n "$RELEASE_SHA" ]] || die "RELEASE_TARBALL or RELEASE_SHA required"

if [[ -n "$RELEASE_TARBALL" ]]; then
  [[ -f "$RELEASE_TARBALL" ]] || die "tarball not found: $RELEASE_TARBALL"
  if [[ -z "$RELEASE_SHA" ]]; then
    RELEASE_SHA="$(basename "$RELEASE_TARBALL" | sed -n 's/^prod8-release-\([0-9a-f]\{40\}\)\.tar\.gz$/\1/p')"
  fi
fi
[[ -n "$RELEASE_SHA" ]] || die "unable to resolve RELEASE_SHA"
TARGET="${RELEASES_DIR}/${RELEASE_SHA}"

if [[ ! -d "$TARGET" ]]; then
  [[ -n "$RELEASE_TARBALL" ]] || die "release dir missing and no tarball provided"
  mkdir -p "$TARGET"
  log "extract $RELEASE_TARBALL -> $TARGET"
  tar -xzf "$RELEASE_TARBALL" -C "$TARGET"
  chown -R "$APP_USER:$APP_USER" "$TARGET"
fi

DEPLOY_PATH="$TARGET"
export DEPLOY_PATH ENV_DIR

log "verify database credentials"
bash "${DEPLOY_PATH}/scripts/vps-deploy/verify-db-env.sh" "$ENV_DIR/api.env"

log "stop services before migration"
systemctl stop "${UNIT_PREFIX}-api.service" || true
bash "${DEPLOY_PATH}/scripts/vps-deploy/stop-stale-listeners.sh" || true

log "pre-migrate Postgres dump (restore point)"
ENV_DIR="$ENV_DIR" DEPLOY_PATH="$DEPLOY_PATH" \
  bash "${DEPLOY_PATH}/scripts/vps-deploy/pre-migrate-pg-dump.sh" || die "pre-migrate dump failed"

run_as_app() {
  sudo -u "$APP_USER" env HOME="$DEPLOY_PATH" PATH="/usr/local/bin:/usr/bin:/bin" bash -lc "$1"
}

log "migration preflight + deploy (forward-only)"
run_as_app "
  set -euo pipefail
  cd '$DEPLOY_PATH'
  set -a && source '$ENV_DIR/api.env' && set +a
  bash scripts/vps-deploy/ensure-prod-postgres-extensions.sh '$ENV_DIR/api.env'
  pnpm run db:migrate:deploy
"

bash "${DEPLOY_PATH}/scripts/vps-deploy/sync-db-app-role-grants.sh" "$ENV_DIR/api.env"
bash "${DEPLOY_PATH}/scripts/vps-deploy/sync-web-api-url-port.sh"
bash "${DEPLOY_PATH}/scripts/vps-deploy/ensure-p8-profile-b-fallback.sh"
if [[ -f "$ENV_DIR/marketing.env" && -f "$ENV_DIR/portal.env" ]]; then
  ENV_DIR="$ENV_DIR" bash "${DEPLOY_PATH}/scripts/vps-deploy/verify-env-coherence.sh" --all
else
  ENV_DIR="$ENV_DIR" bash "${DEPLOY_PATH}/scripts/vps-deploy/verify-env-coherence.sh"
fi

PREVIOUS_SHA=""
if [[ -L "$CURRENT_LINK" ]]; then
  PREVIOUS_SHA="$(readlink -f "$CURRENT_LINK" | xargs basename)"
fi

log "atomic activate release $RELEASE_SHA"
RELEASE_SHA="$RELEASE_SHA" DEPLOY_ROOT="$DEPLOY_ROOT" \
  bash "${DEPLOY_PATH}/scripts/vps-deploy/activate-immutable-release.sh"

ACTIVE_PATH="$(readlink -f "$CURRENT_LINK")"
bash "${ACTIVE_PATH}/scripts/vps-deploy/install-systemd-units.sh"

log "restart four-process units"
systemctl restart "${UNIT_PREFIX}-api.service"
systemctl restart "${UNIT_PREFIX}-web.service"
[[ -f "$ENV_DIR/marketing.env" ]] && systemctl restart "${UNIT_PREFIX}-marketing.service"
[[ -f "$ENV_DIR/portal.env" ]] && systemctl restart "${UNIT_PREFIX}-portal.service"

if [[ -f "$ENV_DIR/marketing.env" && -f "$ENV_DIR/portal.env" ]]; then
  if ! ENV_DIR="$ENV_DIR" bash "${ACTIVE_PATH}/scripts/vps-deploy/smoke-four-process.sh"; then
    log "SMOKE FAILED — initiating rollback to ${PREVIOUS_SHA:-<none>}"
    if [[ -n "$PREVIOUS_SHA" ]]; then
      LATEST_DUMP="$(ls -1t /var/backups/app-cloud/pre-migrate-*.dump 2>/dev/null | head -1 || true)"
      if [[ -n "$LATEST_DUMP" ]]; then
        ROLLBACK_SHA="$PREVIOUS_SHA" ROLLBACK_DB_DUMP="$LATEST_DUMP" \
          DEPLOY_PATH="$ACTIVE_PATH" ENV_DIR="$ENV_DIR" UNIT_PREFIX="$UNIT_PREFIX" \
          bash "${ACTIVE_PATH}/scripts/vps-deploy/rollback-vps.sh" || true
      else
        die "smoke failed and no restore point for paired rollback — see docs/phase-23/runbooks/p10-incident-four-process.md INC-02"
      fi
    else
      die "smoke failed with no previous release — incident procedure required"
    fi
    die "deploy rolled back after smoke failure"
  fi
else
  ENV_DIR="$ENV_DIR" bash "${ACTIVE_PATH}/scripts/vps-deploy/health-check.sh" || die "health-check failed"
fi

ENV_DIR="$ENV_DIR" bash "${ACTIVE_PATH}/scripts/vps-deploy/smoke-operator-login.sh"
log "deploy complete at $RELEASE_SHA"
echo "DEPLOY_IMMUTABLE_RELEASE_OK"
