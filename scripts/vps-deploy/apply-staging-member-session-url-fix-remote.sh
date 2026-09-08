#!/usr/bin/env bash
# Apply staging member-session URL fix over SSH (no full redeploy).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
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

echo "== apply-staging-member-session-url-fix-remote → ${VPS_USER}@${VPS_HOST} =="

rsync -az \
  "${ROOT}/scripts/vps-deploy/sync-staging-profile-b-public-urls.sh" \
  "${ROOT}/scripts/vps-deploy/apply-staging-member-session-url-fix.sh" \
  "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/scripts/vps-deploy/"

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" \
  "ENV_DIR='${ENV_DIR}' bash '${DEPLOY_PATH}/scripts/vps-deploy/apply-staging-member-session-url-fix.sh'"

echo "REMOTE_APPLY_STAGING_MEMBER_SESSION_URL_FIX_OK"
