#!/usr/bin/env bash
# P7 — fast VPS staging smoke (seconds — no p7:gate / no pnpm install)
# @see docs/phase-20/p7/runbooks/p7-0-env-matrix.md · TEMP/FOR YOU.md
set -euo pipefail

VPS_HOST="${VPS_HOST:-89.42.210.252}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_PATH="${VPS_DEPLOY_PATH:-/opt/app-tour-staging}"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
API_PORT="${STAGING_API_PORT:-23001}"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)
if [[ -n "${VPS_SSH_KEY:-}" ]]; then
  KEY_FILE="$(mktemp)"
  trap 'rm -f "$KEY_FILE"' EXIT
  printf '%s\n' "$VPS_SSH_KEY" >"$KEY_FILE"
  chmod 600 "$KEY_FILE"
  SSH_OPTS+=(-i "$KEY_FILE")
fi

echo "== p7:staging-remote-smoke → ${VPS_USER}@${VPS_HOST} =="

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
DEPLOY="${DEPLOY_PATH}"
ENV="${ENV_DIR}"
API="http://127.0.0.1:${API_PORT}"

echo "== env coherence =="
if [[ -f "\$ENV/marketing.env" && -f "\$ENV/portal.env" ]]; then
  ENV_DIR="\$ENV" bash "\$DEPLOY/scripts/vps-deploy/verify-env-coherence.sh" --all
else
  ENV_DIR="\$ENV" bash "\$DEPLOY/scripts/vps-deploy/verify-env-coherence.sh"
fi

echo "== api health =="
curl -sf "\${API}/health" | head -c 120
echo

echo "== host bind =="
TOUR_OPS_API_URL="\$API" node "\$DEPLOY/scripts/smoke-p6-host-bind.mjs"

echo "== systemd =="
systemctl is-active app-tour-staging-api app-tour-staging-web app-tour-staging-marketing app-tour-staging-portal

for p in 23000 23002 23003; do
  code=\$(curl -sf -o /dev/null -w '%{http_code}' "http://127.0.0.1:\$p/health" 2>/dev/null || echo 000)
  echo "health :\$p → \$code"
done
EOF

echo "P7_STAGING_REMOTE_SMOKE_OK"
