#!/usr/bin/env bash
# BLK-P7-00 fast path — rsync existing local .next only (skip rebuild)
# Use when apps/web/.next/BUILD_ID already exists from STAGING_WEB_BUILD=1 build.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VPS_HOST="${VPS_HOST:-89.42.210.252}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_PATH="${VPS_DEPLOY_PATH:-/opt/app-tour-staging}"
WEB="${ROOT}/apps/web"
UNIT="${UNIT_PREFIX:-app-tour-staging}-web"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)

log() { printf '[sync-staging-web-rsync] %s\n' "$*"; }

[[ -f "${WEB}/.next/BUILD_ID" ]] || {
  echo "sync-staging-web-rsync: missing ${WEB}/.next/BUILD_ID — run p7:sync-staging-web first" >&2
  exit 1
}

log "rsync .next → ${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/apps/web/"
rsync -az --delete \
  "${WEB}/.next/" \
  "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/apps/web/.next/"

log "restart ${UNIT}"
ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" "systemctl restart ${UNIT} && sleep 3 && systemctl is-active ${UNIT}"

log "probe wizard"
VPS_HOST="$VPS_HOST" VPS_USER="$VPS_USER" bash "${ROOT}/scripts/p7-staging-wizard-probe.sh"

echo "SYNC_STAGING_WEB_RSYNC_OK"
