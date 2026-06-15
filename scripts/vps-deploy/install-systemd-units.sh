#!/usr/bin/env bash
# Install or refresh app-tour systemd units (run on bootstrap and each deploy).
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/app-tour}"
ENV_DIR="${ENV_DIR:-/etc/app-tour}"
APP_USER="${APP_USER:-app-tour}"

[[ "$(id -u)" -eq 0 ]] || {
  echo "install-systemd-units: run as root" >&2
  exit 1
}

[[ -f "$DEPLOY_PATH/deploy/vps/systemd/app-tour-api.service" ]] || {
  echo "install-systemd-units: missing unit templates under $DEPLOY_PATH/deploy/vps/systemd" >&2
  exit 1
}

chmod +x "$DEPLOY_PATH"/scripts/vps-deploy/start-api.sh
chmod +x "$DEPLOY_PATH"/scripts/vps-deploy/start-web.sh

sed \
  -e "s|@DEPLOY_PATH@|$DEPLOY_PATH|g" \
  -e "s|@APP_USER@|$APP_USER|g" \
  -e "s|@ENV_DIR@|$ENV_DIR|g" \
  "$DEPLOY_PATH/deploy/vps/systemd/app-tour-api.service" \
  > /etc/systemd/system/app-tour-api.service

sed \
  -e "s|@DEPLOY_PATH@|$DEPLOY_PATH|g" \
  -e "s|@APP_USER@|$APP_USER|g" \
  -e "s|@ENV_DIR@|$ENV_DIR|g" \
  "$DEPLOY_PATH/deploy/vps/systemd/app-tour-web.service" \
  > /etc/systemd/system/app-tour-web.service

systemctl daemon-reload
systemctl enable app-tour-api.service app-tour-web.service
echo "[install-systemd-units] refreshed app-tour-api + app-tour-web"
