#!/usr/bin/env bash
# P7-2-N-001 — sync operator identity seed + web workspace UI to staging VPS
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VPS_HOST="${VPS_HOST:-89.45.89.206}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_PATH="${VPS_DEPLOY_PATH:-/opt/app-tour-staging}"
PREFIX="${UNIT_PREFIX:-app-tour-staging}"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)
RSYNC_EX=(--exclude node_modules --exclude .next --exclude .turbo)

log() { printf '[sync-staging-ws-reg-vps] %s\n' "$*"; }

log "rsync API identity seed scripts → ${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}"
rsync -az \
  "${ROOT}/apps/api/scripts/seed-operator-smoke-identity-staging.ts" \
  "${ROOT}/apps/api/scripts/seed-operator-staging.ts" \
  "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/apps/api/scripts/"

log "rsync web workspace registrations sources"
rsync -az "${RSYNC_EX[@]}" \
  "${ROOT}/apps/web/app/(app)/tours/[id]/workspace/" \
  "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/apps/web/app/(app)/tours/[id]/workspace/"
rsync -az \
  "${ROOT}/apps/web/src/features/tours/tour-workspace-registrations-logic.ts" \
  "${ROOT}/apps/web/src/features/tours/tour-workspace-types.ts" \
  "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/apps/web/src/features/tours/"

log "rebuild web on VPS · restart api"
ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
DEPLOY_PATH="${DEPLOY_PATH}"
PREFIX="${PREFIX}"

cd "\${DEPLOY_PATH}/apps/web"
export NODE_ENV=production CI=true NEXT_FONT_OFFLINE=1
rm -rf .next
pnpm exec next build
test -f .next/BUILD_ID
systemctl restart "\${PREFIX}-web"
sleep 2
systemctl is-active "\${PREFIX}-web"
systemctl restart "\${PREFIX}-api"
sleep 2
systemctl is-active "\${PREFIX}-api"
EOF

log "run workspace registrations probe"
VPS_HOST="$VPS_HOST" VPS_USER="$VPS_USER" bash "${ROOT}/scripts/p7-staging-workspace-registrations-probe.sh"

echo "SYNC_STAGING_WORKSPACE_REGISTRATIONS_VPS_OK"
