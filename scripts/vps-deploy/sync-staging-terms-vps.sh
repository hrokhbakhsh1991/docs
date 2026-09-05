#!/usr/bin/env bash
# P7-1-N-008 — sync terms egress (API catalog + marketing + portal) to staging VPS
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VPS_HOST="${VPS_HOST:-89.42.210.252}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_PATH="${VPS_DEPLOY_PATH:-/opt/app-tour-staging}"
PREFIX="${UNIT_PREFIX:-app-tour-staging}"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)
RSYNC_EX=(--exclude node_modules --exclude .next --exclude .turbo)

log() { printf '[sync-staging-terms-vps] %s\n' "$*"; }

for pkg in workspace-sdk workspaces/denali; do
  [[ -d "${ROOT}/packages/${pkg}/dist" ]] || {
    echo "missing packages/${pkg}/dist — run pnpm --filter build first" >&2
    exit 1
  }
done

log "rsync dist + app sources → ${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}"
rsync -az "${ROOT}/packages/workspace-sdk/dist/" \
  "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/packages/workspace-sdk/dist/"
rsync -az "${ROOT}/packages/workspaces/denali/dist/" \
  "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/packages/workspaces/denali/dist/"

rsync -az "${ROOT}/apps/api/src/fixtures/" \
  "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/apps/api/src/fixtures/"
rsync -az "${ROOT}/apps/api/src/settings/seed-operator-smoke-published-tour.ts" \
  "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/apps/api/src/settings/"
rsync -az "${ROOT}/apps/api/scripts/ensure-operator-smoke-policies-staging.ts" \
  "${ROOT}/apps/api/scripts/seed-operator-staging.ts" \
  "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/apps/api/scripts/"

rsync -az "${RSYNC_EX[@]}" "${ROOT}/apps/marketing/" \
  "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/apps/marketing/"
rsync -az "${RSYNC_EX[@]}" "${ROOT}/apps/portal/" \
  "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/apps/portal/"

log "build marketing + portal on VPS · restart api/marketing/portal"
ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
DEPLOY_PATH="${DEPLOY_PATH}"
PREFIX="${PREFIX}"

build_next() {
  local app="\$1"
  local unit="\$2"
  cd "\${DEPLOY_PATH}/apps/\${app}"
  export NODE_ENV=production CI=true NEXT_FONT_OFFLINE=1
  rm -rf .next
  pnpm exec next build
  test -f .next/BUILD_ID
  systemctl restart "\${unit}"
  sleep 2
  systemctl is-active "\${unit}"
}

systemctl restart "\${PREFIX}-api"
sleep 2
systemctl is-active "\${PREFIX}-api"
build_next marketing "\${PREFIX}-marketing"
build_next portal "\${PREFIX}-portal"
EOF

log "run terms probe"
VPS_HOST="$VPS_HOST" VPS_USER="$VPS_USER" bash "${ROOT}/scripts/p7-staging-terms-probe.sh"

echo "SYNC_STAGING_TERMS_VPS_OK"
