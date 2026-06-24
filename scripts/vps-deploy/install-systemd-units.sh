#!/usr/bin/env bash
# Install or refresh app-tour systemd units (run on bootstrap and each deploy).
# Staging: UNIT_PREFIX=app-tour-staging DEPLOY_PATH=/opt/app-tour-staging ENV_DIR=/etc/app-tour-staging
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/app-tour}"
ENV_DIR="${ENV_DIR:-/etc/app-tour}"
APP_USER="${APP_USER:-app-tour}"
UNIT_PREFIX="${UNIT_PREFIX:-app-tour}"

[[ "$(id -u)" -eq 0 ]] || {
  echo "install-systemd-units: run as root" >&2
  exit 1
}

[[ -f "$DEPLOY_PATH/deploy/vps/systemd/app-tour-api.service" ]] || {
  echo "install-systemd-units: missing unit templates under $DEPLOY_PATH/deploy/vps/systemd" >&2
  exit 1
}

for script in start-api.sh start-web.sh start-marketing.sh start-portal.sh; do
  chmod +x "$DEPLOY_PATH/scripts/vps-deploy/$script"
done

install_unit() {
  local suffix="$1"
  local template="$DEPLOY_PATH/deploy/vps/systemd/app-tour-${suffix}.service"
  local unit_name="${UNIT_PREFIX}-${suffix}.service"
  sed \
    -e "s|@DEPLOY_PATH@|$DEPLOY_PATH|g" \
    -e "s|@APP_USER@|$APP_USER|g" \
    -e "s|@ENV_DIR@|$ENV_DIR|g" \
    -e "s|app-tour-api.service|${UNIT_PREFIX}-api.service|g" \
    "$template" \
    > "/etc/systemd/system/${unit_name}"
}

for suffix in api web marketing portal; do
  install_unit "$suffix"
done

systemctl daemon-reload
systemctl enable "${UNIT_PREFIX}-api.service" "${UNIT_PREFIX}-web.service" \
  "${UNIT_PREFIX}-marketing.service" "${UNIT_PREFIX}-portal.service"
echo "[install-systemd-units] refreshed ${UNIT_PREFIX}-{api,web,marketing,portal}"
