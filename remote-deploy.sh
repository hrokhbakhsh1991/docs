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

log "sync $BRANCH"
cd "$DEPLOY_PATH"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"
chown -R "$APP_USER:$APP_USER" "$DEPLOY_PATH"

run_as_app() {
  sudo -u "$APP_USER" env HOME="$DEPLOY_PATH" PATH="/usr/local/bin:/usr/bin:/bin" bash -lc "$1"
}

run_as_app "
  set -euo pipefail
  cd '$DEPLOY_PATH'
  corepack enable
  corepack prepare pnpm@9.12.0 --activate
  node -v | grep -q '^v24\\.' || { echo 'Node 24 required'; exit 1; }
  pnpm install --frozen-lockfile
  pnpm run build:operator-vps
  set -a
  source '$ENV_DIR/api.env'
  set +a
  pnpm run db:migrate:deploy
"

log "restart services"
systemctl restart app-tour-api.service
systemctl restart app-tour-web.service

log "health"
bash "$DEPLOY_PATH/scripts/vps-deploy/health-check.sh"

log "deploy complete"
