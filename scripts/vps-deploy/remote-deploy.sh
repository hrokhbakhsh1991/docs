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

run_as_app "
  set -euo pipefail
  cd '$DEPLOY_PATH'
  bash scripts/vps-deploy/bootstrap-prod-identity.sh '$ENV_DIR/api.env'
"

log "sync web BFF upstream port with api.env"
bash "$DEPLOY_PATH/scripts/vps-deploy/sync-web-api-url-port.sh"
bash "$DEPLOY_PATH/scripts/vps-deploy/verify-env-coherence.sh"

log "refresh systemd units"
bash "$DEPLOY_PATH/scripts/vps-deploy/install-systemd-units.sh"

log "stop stale listeners before restart"
bash "$DEPLOY_PATH/scripts/vps-deploy/stop-stale-listeners.sh"

log "restart services"
systemctl restart app-tour-api.service
systemctl restart app-tour-web.service

# shellcheck source=lib/ports.sh
source "$DEPLOY_PATH/scripts/vps-deploy/lib/ports.sh"
collect_app_ports "$ENV_DIR"
if ! wait_for_port_listen "$API_PORT" 30 1; then
  die "API did not bind :${API_PORT} — check journalctl -u app-tour-api"
fi
if ! wait_for_port_listen "$WEB_PORT" 30 1; then
  die "web did not bind :${WEB_PORT} — check journalctl -u app-tour-web"
fi

log "infra profile"
bash "$DEPLOY_PATH/scripts/vps-deploy/show-infra-profile.sh" "$ENV_DIR/api.env" || true

log "health"
bash "$DEPLOY_PATH/scripts/vps-deploy/health-check.sh"

log "smoke operator login"
bash "$DEPLOY_PATH/scripts/vps-deploy/smoke-operator-login.sh"

log "deploy complete"
