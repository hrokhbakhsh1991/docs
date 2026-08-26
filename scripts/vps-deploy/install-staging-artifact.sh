#!/usr/bin/env bash
# VPS-local: extract artifact, migrate, switch current symlink, install systemd units.
# Run as root on touriran after transferring app-tour-staging-<sha>.tar.zst + .sha256
#
#   ARTIFACT=/tmp/app-tour-staging-<sha>.tar.zst \
#   bash scripts/vps-deploy/install-staging-artifact.sh
set -euo pipefail

ARTIFACT="${ARTIFACT:?ARTIFACT path required}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/app-tour-staging}"
RELEASES_DIR="${DEPLOY_ROOT}/releases"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
APP_USER="${APP_USER:-app-tour}"
UNIT_PREFIX="${UNIT_PREFIX:-app-tour-staging}"
TOOLING="${DEPLOY_ROOT}/tooling"

log() { printf '[install-artifact] %s\n' "$*"; }

[[ "$(id -u)" -eq 0 ]] || {
  echo "install-staging-artifact: run as root" >&2
  exit 1
}

[[ -f "$ARTIFACT" ]] || {
  echo "install-staging-artifact: missing $ARTIFACT" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ensure-staging-artifact-prerequisites.sh
source "${SCRIPT_DIR}/ensure-staging-artifact-prerequisites.sh"

SHA="$(basename "$ARTIFACT" .tar.zst | sed 's/^app-tour-staging-//')"
if [[ -f "${ARTIFACT}.sha256" ]]; then
  (
    cd "$(dirname "$ARTIFACT")"
    sha256sum -c "$(basename "${ARTIFACT}.sha256")"
  )
fi

log "stop staging units"
for u in ${UNIT_PREFIX}-{api,web,marketing,portal}; do
  systemctl stop "$u" 2>/dev/null || true
  systemctl disable "$u" 2>/dev/null || true
done

log "extract release ${SHA}"
mkdir -p "$RELEASES_DIR" "${TOOLING}/scripts/vps-deploy"
for f in start-api-artifact.sh start-next-artifact.sh; do
  src="${SCRIPT_DIR}/${f}"
  dest="${TOOLING}/scripts/vps-deploy/${f}"
  if [[ "$(readlink -f "$src")" != "$(readlink -f "$dest" 2>/dev/null || echo "")" ]]; then
    cp -a "$src" "$dest"
    chmod +x "$dest"
  fi
done
rm -rf "${RELEASES_DIR}/${SHA}"
mkdir -p "${RELEASES_DIR}/${SHA}"
tar -I zstd -xf "$ARTIFACT" -C "${RELEASES_DIR}/${SHA}" --strip-components=1

chown -R "${APP_USER}:${APP_USER}" "${RELEASES_DIR}/${SHA}"

[[ -f "${RELEASES_DIR}/${SHA}/api/dist/main.js" ]] || {
  echo "install-staging-artifact: invalid artifact — missing api/dist/main.js" >&2
  exit 1
}

log "ensure staging JWT keys (reject placeholder PEM)"
ENV_DIR="$ENV_DIR" RELEASE_ROOT="${RELEASES_DIR}/${SHA}" \
  bash "${SCRIPT_DIR}/ensure-staging-jwt-keys.sh"

log "sync surface auth env from api.env"
ENV_DIR="$ENV_DIR" bash "${SCRIPT_DIR}/sync-staging-surface-auth-env.sh"

log "sync Profile B marketing↔portal public URLs"
ENV_DIR="$ENV_DIR" bash "${SCRIPT_DIR}/sync-staging-profile-b-public-urls.sh"

log "re-sync JWT public keys after profile URL pass"
ENV_DIR="$ENV_DIR" bash "${SCRIPT_DIR}/sync-staging-surface-auth-env.sh"

log "migrate deploy (staging DB only)"
set -a
# shellcheck source=/dev/null
source "${ENV_DIR}/api.env"
set +a
export DATABASE_URL="${DATABASE_URL_ADMIN:-$DATABASE_URL}"
sudo -u "$APP_USER" env HOME="$DEPLOY_ROOT" \
  bash "${RELEASES_DIR}/${SHA}/bin/migrate-deploy.sh" "${ENV_DIR}/api.env"

log "seed staging (synthetic operator/Denali)"
sudo -u "$APP_USER" env HOME="$DEPLOY_ROOT" \
  bash "${RELEASES_DIR}/${SHA}/bin/seed-staging.sh" "${ENV_DIR}/api.env"

PREVIOUS=""
if [[ -L "${DEPLOY_ROOT}/current" ]]; then
  PREVIOUS="$(readlink -f "${DEPLOY_ROOT}/current")"
  echo "$PREVIOUS" >"${DEPLOY_ROOT}/previous-release"
fi
ln -sfn "${RELEASES_DIR}/${SHA}" "${DEPLOY_ROOT}/current"

install_unit() {
  local suffix="$1" exec_start="$2" extra_env="${3:-}"
  local unit="${UNIT_PREFIX}-${suffix}.service"
  cat >"/etc/systemd/system/${unit}" <<UNIT
[Unit]
Description=App Tour Staging ${suffix} (artifact)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${DEPLOY_ROOT}/current
Environment=RELEASE_ROOT=${DEPLOY_ROOT}/current
Environment=ENV_DIR=${ENV_DIR}
${extra_env}
ExecStart=${exec_start}
Restart=on-failure
RestartSec=5
StartLimitIntervalSec=300
StartLimitBurst=5
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
UNIT
}

install_unit api "${TOOLING}/scripts/vps-deploy/start-api-artifact.sh" ""
install_unit web "${TOOLING}/scripts/vps-deploy/start-next-artifact.sh" "Environment=APP_KEY=web"
install_unit portal "${TOOLING}/scripts/vps-deploy/start-next-artifact.sh" "Environment=APP_KEY=portal"
install_unit marketing "${TOOLING}/scripts/vps-deploy/start-next-artifact.sh" "Environment=APP_KEY=marketing"

systemctl daemon-reload

for u in ${UNIT_PREFIX}-{api,web,marketing,portal}; do
  systemctl enable "$u"
done

log "INSTALL_ARTIFACT_OK sha=${SHA} previous=${PREVIOUS:-none}"
log "start: systemctl start ${UNIT_PREFIX}-api && health; then web, portal, marketing"
