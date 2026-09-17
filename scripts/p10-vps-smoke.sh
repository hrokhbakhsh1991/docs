#!/usr/bin/env bash
# Run smoke-four-process on VPS via SSH (do not run /opt/... paths locally)
set -euo pipefail

VPS_HOST="${VPS_HOST:-89.42.210.252}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_PATH="${VPS_DEPLOY_PATH:-/opt/app-tour-staging}"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=20)
if [[ -n "${VPS_SSH_KEY:-}" ]]; then
  KEY_FILE="$(mktemp)"
  trap 'rm -f "$KEY_FILE"' EXIT
  printf '%s\n' "$VPS_SSH_KEY" >"$KEY_FILE"
  chmod 600 "$KEY_FILE"
  SSH_OPTS+=(-i "$KEY_FILE")
fi

echo "== p10:vps-smoke → ${VPS_USER}@${VPS_HOST} =="

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" \
  "ENV_DIR='${ENV_DIR}' bash '${DEPLOY_PATH}/scripts/vps-deploy/smoke-four-process.sh'"

echo "P10_VPS_SMOKE_OK"
