#!/usr/bin/env bash
# Rebuild @app-tour/platform-core on staging VPS (tsx may load stale dist without draftTombstone strip).
set -euo pipefail

VPS_HOST="${VPS_HOST:-89.42.210.252}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_PATH="${VPS_DEPLOY_PATH:-/opt/app-tour-staging}"
SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)

echo "== p7:staging-sync-platform-core → ${VPS_USER}@${VPS_HOST} =="

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
cd "${DEPLOY_PATH}"
pnpm --filter @app-tour/platform-core run build
systemctl restart app-tour-staging-api
sleep 4
systemctl is-active app-tour-staging-api
echo "P7_STAGING_SYNC_PLATFORM_CORE_OK"
EOF
