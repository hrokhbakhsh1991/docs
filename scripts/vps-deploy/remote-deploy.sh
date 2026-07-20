#!/usr/bin/env bash
# Run on VPS after each push to main (via GitHub Actions SSH or manual).
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/app-tour}"
ENV_DIR="${ENV_DIR:-/etc/app-tour}"
APP_USER="${APP_USER:-app-tour}"
BRANCH="${DEPLOY_BRANCH:-main}"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

log() {
  printf '[vps-deploy] %s\n' "$*"
}

die() {
  printf '[vps-deploy] ERROR: %s\n' "$*" >&2
  exit 1
}

[[ -d "$DEPLOY_PATH/.git" ]] || die "repo missing at $DEPLOY_PATH — run bootstrap-server.sh first"
[[ -f "$ENV_DIR/api.env" ]] || die "missing $ENV_DIR/api.env — copy deploy/vps/env/api.env.example"
[[ -f "$ENV_DIR/web.env" ]] || die "missing $ENV_DIR/web.env — copy deploy/vps/env/web.env.example"

chmod +x "$DEPLOY_PATH"/scripts/vps-deploy/*.sh 2>/dev/null || true

log "verify database credentials"
if ! bash "$DEPLOY_PATH/scripts/vps-deploy/verify-db-env.sh" "$ENV_DIR/api.env"; then
  log "DATABASE_URL probe failed — syncing app_tour password from env"
  bash "$DEPLOY_PATH/scripts/vps-deploy/sync-db-app-role-password.sh" "$ENV_DIR/api.env"
  bash "$DEPLOY_PATH/scripts/vps-deploy/verify-db-env.sh" "$ENV_DIR/api.env"
fi

log "sync $BRANCH"
cd "$DEPLOY_PATH"
git fetch origin "$BRANCH:refs/remotes/origin/$BRANCH"
git reset --hard "origin/$BRANCH"
chown -R "$APP_USER:$APP_USER" "$DEPLOY_PATH"

log "stop services before build (release .next / dist locks)"
bash "$DEPLOY_PATH/scripts/vps-deploy/stop-stale-listeners.sh"

run_as_app() {
  sudo -u "$APP_USER" env HOME="$DEPLOY_PATH" PATH="/usr/local/bin:/usr/bin:/bin" bash -lc "$1"
}

run_as_app "
  set -euo pipefail
  cd '$DEPLOY_PATH'
  /usr/local/bin/pnpm install --frozen-lockfile
  bash scripts/vps-deploy/build-operator-vps.sh
  set -a
  source '$ENV_DIR/api.env'
  set +a
  bash scripts/vps-deploy/ensure-prod-postgres-extensions.sh '$ENV_DIR/api.env'
  pnpm run db:migrate:deploy
"

bash "$DEPLOY_PATH/scripts/vps-deploy/sync-db-app-role-grants.sh" "$ENV_DIR/api.env"

# MR-P0-013: identity bootstrap is opt-in (FORCE_BOOTSTRAP=1), not every deploy.
if [[ "${FORCE_BOOTSTRAP:-}" == "1" ]]; then
  run_as_app "
    set -euo pipefail
    cd '$DEPLOY_PATH'
    FORCE_BOOTSTRAP=1 bash scripts/vps-deploy/bootstrap-prod-identity.sh '$ENV_DIR/api.env'
  "
else
  log "skip bootstrap-prod-identity (set FORCE_BOOTSTRAP=1 for one-time seed)"
fi

log "sync web BFF upstream port with api.env"
bash "$DEPLOY_PATH/scripts/vps-deploy/ensure-p8-profile-b-fallback.sh"
bash "$DEPLOY_PATH/scripts/vps-deploy/sync-web-api-url-port.sh"
if [[ -f "$ENV_DIR/marketing.env" && -f "$ENV_DIR/portal.env" ]]; then
  ENV_DIR="$ENV_DIR" bash "$DEPLOY_PATH/scripts/vps-deploy/verify-env-coherence.sh" --all
else
  ENV_DIR="$ENV_DIR" bash "$DEPLOY_PATH/scripts/vps-deploy/verify-env-coherence.sh"
fi

log "refresh systemd units"
bash "$DEPLOY_PATH/scripts/vps-deploy/install-systemd-units.sh"

log "stop stale listeners before restart"
bash "$DEPLOY_PATH/scripts/vps-deploy/stop-stale-listeners.sh"

log "restart services"
systemctl restart app-tour-api.service
systemctl restart app-tour-web.service
if [[ -f "$ENV_DIR/marketing.env" ]]; then
  systemctl restart app-tour-marketing.service
fi
if [[ -f "$ENV_DIR/portal.env" ]]; then
  systemctl restart app-tour-portal.service
fi

# shellcheck source=lib/ports.sh
source "$DEPLOY_PATH/scripts/vps-deploy/lib/ports.sh"
collect_app_ports "$ENV_DIR"
if ! wait_for_port_listen "$API_PORT" 30 1; then
  die "API did not bind :${API_PORT} — check journalctl -u app-tour-api"
fi
if ! wait_for_port_listen "$WEB_PORT" 30 1; then
  die "web did not bind :${WEB_PORT} — check journalctl -u app-tour-web"
fi
if [[ -f "$ENV_DIR/marketing.env" ]]; then
  MKT_PORT="$(read_env_port "$ENV_DIR/marketing.env" PORT 3002)"
  if ! wait_for_port_listen "$MKT_PORT" 30 1; then
    die "marketing did not bind :${MKT_PORT} — check journalctl -u app-tour-marketing"
  fi
fi
if [[ -f "$ENV_DIR/portal.env" ]]; then
  PTL_PORT="$(read_env_port "$ENV_DIR/portal.env" PORT 3003)"
  if ! wait_for_port_listen "$PTL_PORT" 30 1; then
    die "portal did not bind :${PTL_PORT} — check journalctl -u app-tour-portal"
  fi
fi

log "infra profile"
bash "$DEPLOY_PATH/scripts/vps-deploy/show-infra-profile.sh" "$ENV_DIR/api.env" || true

if [[ -f "$ENV_DIR/marketing.env" && -f "$ENV_DIR/portal.env" ]]; then
  log "smoke four-process (api + web + marketing + portal)"
  if ! ENV_DIR="$ENV_DIR" bash "$DEPLOY_PATH/scripts/vps-deploy/smoke-four-process.sh"; then
    log "SMOKE FAILED — rollback hint: ROLLBACK_SHA=<prev> DEPLOY_PATH=$DEPLOY_PATH ENV_DIR=$ENV_DIR bash $DEPLOY_PATH/scripts/vps-deploy/rollback-vps.sh"
    die "post-deploy smoke-four-process failed"
  fi
else
  log "health (api + web only — marketing/portal env missing)"
  if ! ENV_DIR="$ENV_DIR" bash "$DEPLOY_PATH/scripts/vps-deploy/health-check.sh"; then
    log "HEALTH FAILED — see docs/phase-23/runbooks/p10-incident-four-process.md INC-02"
    die "post-deploy health-check failed"
  fi
fi

log "smoke operator login"
ENV_DIR="$ENV_DIR" bash "$DEPLOY_PATH/scripts/vps-deploy/smoke-operator-login.sh"

log "deploy complete"
