#!/usr/bin/env bash
# One-time VPS bootstrap — Node 24, clone repo, systemd units, env templates.
# Run as root on the VPS: bash scripts/vps-deploy/bootstrap-server.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/app-tour}"
ENV_DIR="${ENV_DIR:-/etc/app-tour}"
APP_USER="${APP_USER:-app-tour}"
REPO_URL="${REPO_URL:-https://github.com/hrokhbakhsh1991/docs.git}"
BRANCH="${DEPLOY_BRANCH:-main}"

log() {
  printf '[bootstrap] %s\n' "$*"
}

install_node_24_if_needed() {
  if command -v node >/dev/null 2>&1 && [[ "$(node -p "process.versions.node.split('.')[0]")" == "24" ]]; then
    log "node $(node -v) already installed"
    return
  fi
  log "installing Node 24 (NodeSource)"
  apt-get update -qq
  apt-get install -y curl ca-certificates git rsync postgresql-client python3
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
}

install_deploy_prereqs() {
  apt-get install -y postgresql-client python3 2>/dev/null || true
}

ensure_app_user() {
  if ! id "$APP_USER" >/dev/null 2>&1; then
    useradd --system --create-home --home-dir "$DEPLOY_PATH" --shell /bin/bash "$APP_USER"
    log "created user $APP_USER"
  fi
}

clone_or_update_repo() {
  if [[ ! -d "$DEPLOY_PATH/.git" ]]; then
    mkdir -p "$(dirname "$DEPLOY_PATH")"
    git clone --branch "$BRANCH" "$REPO_URL" "$DEPLOY_PATH"
    log "cloned $REPO_URL -> $DEPLOY_PATH"
  else
    log "repo already exists at $DEPLOY_PATH"
  fi
  chown -R "$APP_USER:$APP_USER" "$DEPLOY_PATH"
}

install_env_templates() {
  mkdir -p "$ENV_DIR"
  chmod 750 "$ENV_DIR"
  if [[ ! -f "$ENV_DIR/api.env" ]]; then
    cp "$DEPLOY_PATH/deploy/vps/env/api.env.example" "$ENV_DIR/api.env"
    chmod 640 "$ENV_DIR/api.env"
    log "created $ENV_DIR/api.env — EDIT BEFORE FIRST DEPLOY"
  fi
  if [[ ! -f "$ENV_DIR/web.env" ]]; then
    cp "$DEPLOY_PATH/deploy/vps/env/web.env.example" "$ENV_DIR/web.env"
    chmod 640 "$ENV_DIR/web.env"
    log "created $ENV_DIR/web.env"
  fi
  chown root:"$APP_USER" "$ENV_DIR"/*.env 2>/dev/null || true
}

install_systemd_units() {
  bash "$DEPLOY_PATH/scripts/vps-deploy/install-systemd-units.sh"
  log "systemd units installed"
}

main() {
  [[ "$(id -u)" -eq 0 ]] || {
    echo "run as root" >&2
    exit 1
  }
  install_node_24_if_needed
  install_deploy_prereqs
  ensure_app_user
  clone_or_update_repo
  install_env_templates
  install_systemd_units
  log "bootstrap done"
  log "next: edit $ENV_DIR/api.env (DATABASE_URL + DATABASE_URL_ADMIN) and $ENV_DIR/web.env"
  log "verify: bash $DEPLOY_PATH/scripts/vps-deploy/verify-db-env.sh $ENV_DIR/api.env"
  log "deploy: sudo -u $APP_USER bash $DEPLOY_PATH/scripts/vps-deploy/remote-deploy.sh"
}

main "$@"
