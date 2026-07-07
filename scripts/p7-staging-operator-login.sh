#!/usr/bin/env bash
# P7-0-N-005 — operator OTP path on VPS staging (~6s)
set -euo pipefail

VPS_HOST="${VPS_HOST:-89.45.89.206}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_PATH="${VPS_DEPLOY_PATH:-/opt/app-tour-staging}"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)
if [[ -n "${VPS_SSH_KEY:-}" ]]; then
  KEY_FILE="$(mktemp)"
  trap 'rm -f "$KEY_FILE"' EXIT
  printf '%s\n' "$VPS_SSH_KEY" >"$KEY_FILE"
  chmod 600 "$KEY_FILE"
  SSH_OPTS+=(-i "$KEY_FILE")
fi

echo "== p7:staging-operator-login → ${VPS_USER}@${VPS_HOST} =="

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
cd "${DEPLOY_PATH}"
ENV_DIR="${ENV_DIR}" bash scripts/vps-deploy/smoke-operator-login.sh
EOF

echo "P7_STAGING_OPERATOR_LOGIN_OK"
