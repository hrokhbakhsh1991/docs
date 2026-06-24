#!/usr/bin/env bash
# P8 — fast VPS staging Profile B smoke (SSH, no local pnpm)
# @see docs/phase-21/runbooks/p8-profile-b-vps-smoke.md
set -euo pipefail

VPS_HOST="${VPS_HOST:-89.45.89.206}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_PATH="${VPS_DEPLOY_PATH:-/opt/app-tour-staging}"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
API_PORT="${STAGING_API_PORT:-23001}"
UNIT_PREFIX="${UNIT_PREFIX:-app-tour-staging}"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)
if [[ -n "${VPS_SSH_KEY:-}" ]]; then
  KEY_FILE="$(mktemp)"
  trap 'rm -f "$KEY_FILE"' EXIT
  printf '%s\n' "$VPS_SSH_KEY" >"$KEY_FILE"
  chmod 600 "$KEY_FILE"
  SSH_OPTS+=(-i "$KEY_FILE")
fi

echo "== p8:staging-remote-smoke → ${VPS_USER}@${VPS_HOST} =="

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
DEPLOY="${DEPLOY_PATH}"
ENV="${ENV_DIR}"
API="http://127.0.0.1:${API_PORT}"
HOST="${VPS_HOST}"

echo "== env coherence (four-process) =="
if [[ -f "\$ENV/marketing.env" && -f "\$ENV/portal.env" ]]; then
  ENV_DIR="\$ENV" bash "\$DEPLOY/scripts/vps-deploy/verify-env-coherence.sh" --all
else
  ENV_DIR="\$ENV" bash "\$DEPLOY/scripts/vps-deploy/verify-env-coherence.sh"
fi

echo "== P6 host bind (loopback API) =="
TOUR_OPS_API_URL="\$API" node "\$DEPLOY/scripts/smoke-p6-host-bind.mjs"

echo "== P8 Profile B (loopback API, public IP host header) =="
P8_PROFILE_B_HOST="\$HOST" TOUR_OPS_API_URL="\$API" \\
  P8_WEB_URL="http://127.0.0.1:23000" \\
  P8_MKT_URL="http://127.0.0.1:23002" \\
  P8_PTL_URL="http://127.0.0.1:23003" \\
  node "\$DEPLOY/scripts/smoke-p8-profile-b.mjs"

echo "== systemd =="
systemctl is-active ${UNIT_PREFIX}-api ${UNIT_PREFIX}-web ${UNIT_PREFIX}-marketing ${UNIT_PREFIX}-portal
EOF

echo "== P8 Profile B (external IP) =="
P8_PROFILE_B_HOST="${VPS_HOST}" node "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/scripts/smoke-p8-profile-b.mjs"

echo "P8_STAGING_REMOTE_SMOKE_OK"
