#!/usr/bin/env bash
# Remote P7 staging gate on VPS via SSH.
# P7_FAST=1 → smoke only (verify-env + host bind). Full gate → TEMP/FOR YOU.md
set -euo pipefail

VPS_USER="${VPS_USER:-root}"
DEPLOY_PATH="${VPS_DEPLOY_PATH:-/opt/app-tour-staging}"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"

if [[ -z "${VPS_HOST:-}" ]]; then
  echo "P7_REMOTE_GATE_FAIL: VPS_HOST not set" >&2
  exit 1
fi

SSH_OPTS=(-o StrictHostKeyChecking=no)
if [[ -n "${VPS_SSH_KEY:-}" ]]; then
  KEY_FILE="$(mktemp)"
  trap 'rm -f "$KEY_FILE"' EXIT
  printf '%s\n' "$VPS_SSH_KEY" >"$KEY_FILE"
  chmod 600 "$KEY_FILE"
  SSH_OPTS+=(-i "$KEY_FILE")
fi

if [[ "${P7_FAST:-}" == "1" ]]; then
  echo "P7 remote fast smoke → ${VPS_USER}@${VPS_HOST}"
  VPS_HOST="$VPS_HOST" VPS_USER="$VPS_USER" VPS_DEPLOY_PATH="$DEPLOY_PATH" ENV_DIR="$ENV_DIR" \
    bash "$(dirname "$0")/p7-staging-remote-smoke.sh"
  exit 0
fi

echo "P7 remote staging gate → ${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}"

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
cd '${DEPLOY_PATH}'
export TOUR_OPS_API_URL=http://127.0.0.1:23001
export ENV_DIR='${ENV_DIR}'
pnpm run p7:staging-gate
EOF

echo "P7_REMOTE_GATE_OK"
