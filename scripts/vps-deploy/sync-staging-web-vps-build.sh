#!/usr/bin/env bash
# BLK-P7-00 — rsync prebuilt dist + web source to VPS, next build there (no slow .next upload)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VPS_HOST="${VPS_HOST:-89.45.89.206}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_PATH="${VPS_DEPLOY_PATH:-/opt/app-tour-staging}"
UNIT="${UNIT_PREFIX:-app-tour-staging}-web"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)
RSYNC_EX=(--exclude node_modules --exclude .next --exclude .turbo)

log() { printf '[sync-staging-web-vps-build] %s\n' "$*"; }

require_dist() {
  local path="$1"
  [[ -d "${ROOT}/${path}/dist" ]] || {
    echo "sync-staging-web-vps-build: missing ${path}/dist — build locally first" >&2
    exit 1
  }
}

require_dist packages/draft-engine
require_dist packages/workspace-sdk
require_dist packages/workspaces/denali

log "rsync prebuilt dist + web source → ${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}"
for pkg in draft-engine workspace-sdk; do
  rsync -az "${ROOT}/packages/${pkg}/dist/" \
    "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/packages/${pkg}/dist/"
done
rsync -az "${ROOT}/packages/workspaces/denali/dist/" \
  "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/packages/workspaces/denali/dist/"
rsync -az "${RSYNC_EX[@]}" \
  "${ROOT}/apps/web/" \
  "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/apps/web/"

log "next build on VPS"
ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
cd "${DEPLOY_PATH}/apps/web"
export NODE_ENV=production CI=true NEXT_FONT_OFFLINE=1 STAGING_WEB_BUILD=1 ALLOW_DENALI_WEB_PLUGIN=true
rm -rf .next
pnpm exec next build
test -f .next/BUILD_ID
systemctl restart ${UNIT}
sleep 3
systemctl is-active ${UNIT}
EOF

log "probe wizard"
VPS_HOST="$VPS_HOST" VPS_USER="$VPS_USER" bash "${ROOT}/scripts/p7-staging-wizard-probe.sh"

echo "SYNC_STAGING_WEB_VPS_BUILD_OK"
