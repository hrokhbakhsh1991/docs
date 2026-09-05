#!/usr/bin/env bash
# BLK-CAT-01 — wire MARKETING_REVALIDATE_* on staging API from marketing.env secret
set -euo pipefail

VPS_HOST="${VPS_HOST:-89.42.210.252}"
VPS_USER="${VPS_USER:-root}"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
MKT_PORT="${STAGING_MARKETING_PORT:-23002}"
UNIT="${UNIT_PREFIX:-app-tour-staging}-api"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)

log() { printf '[configure-staging-revalidate] %s\n' "$*"; }

log "configure ${ENV_DIR}/api.env on ${VPS_USER}@${VPS_HOST}"

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
ENV_DIR="${ENV_DIR}"
MKT_PORT="${MKT_PORT}"
UNIT="${UNIT}"
API_ENV="\${ENV_DIR}/api.env"
MKT_ENV="\${ENV_DIR}/marketing.env"

[[ -f "\$MKT_ENV" ]] || { echo "missing \$MKT_ENV" >&2; exit 1; }
[[ -f "\$API_ENV" ]] || { echo "missing \$API_ENV" >&2; exit 1; }

secret=\$(grep -E '^MARKETING_REVALIDATE_SECRET=' "\$MKT_ENV" | tail -1 | cut -d= -f2- | tr -d '\r')
[[ -n "\$secret" ]] || { echo "MARKETING_REVALIDATE_SECRET missing in marketing.env" >&2; exit 1; }

url="http://127.0.0.1:\${MKT_PORT}"
grep -q '^MARKETING_REVALIDATE_URL=' "\$API_ENV" && \\
  sed -i "s|^MARKETING_REVALIDATE_URL=.*|MARKETING_REVALIDATE_URL=\${url}|" "\$API_ENV" || \\
  printf '\nMARKETING_REVALIDATE_URL=%s\n' "\$url" >> "\$API_ENV"
grep -q '^MARKETING_REVALIDATE_SECRET=' "\$API_ENV" && \\
  sed -i "s|^MARKETING_REVALIDATE_SECRET=.*|MARKETING_REVALIDATE_SECRET=\${secret}|" "\$API_ENV" || \\
  printf 'MARKETING_REVALIDATE_SECRET=%s\n' "\$secret" >> "\$API_ENV"

systemctl restart "\$UNIT"
sleep 2
systemctl is-active "\$UNIT"
grep -E '^MARKETING_REVALIDATE_' "\$API_ENV" | sed 's/=.*/=***/'
EOF

echo "CONFIGURE_STAGING_REVALIDATE_OK"
