#!/usr/bin/env bash
# BLK-P7-00 — build @apps/web locally and rsync .next to VPS staging (~5–15 min local build)
# @see docs/phase-20/p7/runbooks/p7-wizard-blocker-walkthrough.md#BLK-P7-00
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VPS_HOST="${VPS_HOST:-89.42.210.252}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_PATH="${VPS_DEPLOY_PATH:-/opt/app-tour-staging}"
WEB="${ROOT}/apps/web"
UNIT="${UNIT_PREFIX:-app-tour-staging}-web"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)

log() { printf '[sync-staging-web] %s\n' "$*"; }

log "build workspace deps + @apps/web (local)"
cd "$ROOT"
pnpm --filter @app-tour/ui-primitives run build
pnpm --filter @app-tour/tenant-kernel run build
pnpm --filter @app-tour/workspace-denali run build || {
  echo "sync-staging-web: denali tsc failed — fix trunk build first (build-operator-vps.sh)" >&2
  echo "sync-staging-web: interim: use prod .next until DEV build green" >&2
  exit 1
}

(
  cd "$WEB"
  export NODE_ENV=production CI=true NEXT_FONT_OFFLINE=1 STAGING_WEB_BUILD=1
  # Gap Closure D.5 — optional profiled transpile/guest-runtime rewrite for image builds
  if [[ "${WORKSPACE_DEPLOY_PROFILE_APPLY:-}" == "1" ]]; then
    log "apply:deploy-profile --write (APPLY=1)"
    (cd "$ROOT" && pnpm run apply:deploy-profile -- --write)
  fi
  eval "$(node "${ROOT}/scripts/vps-deploy/resolve-staging-web-plugin-allow-env.mjs")"
  pnpm exec next build
  if [[ "${WORKSPACE_DEPLOY_PROFILE_APPLY:-}" == "1" ]]; then
    log "restore trunk generate:workspace-registry after profiled build"
    (cd "$ROOT" && pnpm run generate:workspace-registry)
  fi
)

[[ -f "${WEB}/.next/BUILD_ID" ]] || {
  echo "sync-staging-web: missing ${WEB}/.next/BUILD_ID" >&2
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

echo "SYNC_STAGING_WEB_BUILD_OK"
