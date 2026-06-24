#!/usr/bin/env bash
# Install Caddy + deploy Profile C edge config (P10-1-N-001)
# Usage: ENV_DIR=/etc/app-tour-staging PLATFORM_ROOT_DOMAIN=club.example.com bash install-caddy-profile-c.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/app-tour}"
ENV_DIR="${ENV_DIR:-/etc/app-tour}"
CADDY_CONFIG="${CADDY_CONFIG:-/etc/caddy/Caddyfile}"
CADDY_ENV="${CADDY_ENV_FILE:-/etc/caddy/caddy.env}"

log() { printf '[install-caddy] %s\n' "$*"; }
die() { printf '[install-caddy] ERROR: %s\n' "$*" >&2; exit 1; }

[[ -f "$DEPLOY_PATH/deploy/vps/caddy/Caddyfile" ]] || die "missing $DEPLOY_PATH/deploy/vps/caddy/Caddyfile"

if ! command -v caddy >/dev/null 2>&1; then
  log "installing caddy package"
  apt-get update -qq
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -qq
  apt-get install -y caddy
fi

log "render caddy.env from $ENV_DIR"
ENV_DIR="$ENV_DIR" PLATFORM_ROOT_DOMAIN="${PLATFORM_ROOT_DOMAIN:-}" \
  bash "$DEPLOY_PATH/scripts/vps-deploy/render-caddy-env.sh"

log "deploy Caddyfile"
install -d -m 755 /etc/caddy /var/log/caddy
chown caddy:caddy /var/log/caddy
cp "$DEPLOY_PATH/deploy/vps/caddy/Caddyfile" "$CADDY_CONFIG"
chmod 644 "$CADDY_CONFIG"

if ! grep -q 'EnvironmentFile=-/etc/caddy/caddy.env' /lib/systemd/system/caddy.service 2>/dev/null; then
  log "patch caddy.service EnvironmentFile"
  mkdir -p /etc/systemd/system/caddy.service.d
  cat >/etc/systemd/system/caddy.service.d/override.conf <<'EOF'
[Service]
EnvironmentFile=-/etc/caddy/caddy.env
EOF
fi

systemctl daemon-reload
set -a
# shellcheck source=/dev/null
source "$CADDY_ENV"
set +a
caddy validate --config "$CADDY_CONFIG" --adapter caddyfile

systemctl enable caddy
systemctl restart caddy
systemctl is-active caddy

log "Profile C edge installed — configure DNS wildcard for $(grep PLATFORM_ROOT_DOMAIN "$CADDY_ENV" | cut -d= -f2-)"
log "verify: curl -I https://operator.admin.<root>/auth/login"
