#!/usr/bin/env bash
# Transfer built artifact to VPS and install (no pnpm install/build on VPS).
#
#   VPS_HOST=89.42.210.252 VPS_USER=root \
#   ARTIFACT=dist/staging-artifacts/app-tour-staging-<sha>.tar.zst \
#   bash scripts/vps-deploy/deploy-staging-artifact-remote.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

VPS_HOST="${VPS_HOST:?VPS_HOST required}"
VPS_USER="${VPS_USER:-root}"
SSH_OPTS="${SSH_OPTS:--o ConnectTimeout=20 -o StrictHostKeyChecking=no}"
ARTIFACT="${ARTIFACT:?ARTIFACT path to .tar.zst required}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/app-tour-staging}"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"

[[ -f "$ARTIFACT" ]] || {
  echo "deploy-staging-artifact-remote: missing $ARTIFACT" >&2
  exit 1
}
[[ -f "${ARTIFACT}.sha256" ]] || {
  echo "deploy-staging-artifact-remote: missing ${ARTIFACT}.sha256" >&2
  exit 1
}

REMOTE="${VPS_USER}@${VPS_HOST}"
BASENAME="$(basename "$ARTIFACT")"

log() { printf '[deploy-remote] %s\n' "$*"; }

ssh_cmd() {
  # shellcheck disable=SC2086
  ssh $SSH_OPTS "$REMOTE" "$@"
}

log "preflight SSH"
ssh_cmd 'echo SSH_OK; uptime; free -h | head -2'

log "transfer artifact + checksum"
ssh_cmd "mkdir -p /tmp/app-tour-artifacts ${DEPLOY_ROOT}/tooling/scripts/vps-deploy/lib"
scp $SSH_OPTS "$ARTIFACT" "${ARTIFACT}.sha256" "${REMOTE}:/tmp/app-tour-artifacts/"
for f in start-api-artifact.sh start-next-artifact.sh install-staging-artifact.sh \
  start-staging-artifact-stack.sh recover-vps-staging.sh smoke-four-process.sh; do
  scp $SSH_OPTS "${SCRIPT_DIR}/${f}" "${REMOTE}:${DEPLOY_ROOT}/tooling/scripts/vps-deploy/"
done
scp $SSH_OPTS "${SCRIPT_DIR}/lib/ports.sh" "${REMOTE}:${DEPLOY_ROOT}/tooling/scripts/vps-deploy/lib/ports.sh"

log "install artifact (extract, migrate, systemd — no build)"
ssh_cmd "chmod +x ${DEPLOY_ROOT}/tooling/scripts/vps-deploy/*.sh && \
  ARTIFACT=/tmp/app-tour-artifacts/${BASENAME} \
  DEPLOY_ROOT=${DEPLOY_ROOT} ENV_DIR=${ENV_DIR} \
  bash ${DEPLOY_ROOT}/tooling/scripts/vps-deploy/install-staging-artifact.sh"

log "start stack sequentially"
ssh_cmd "ENV_DIR=${ENV_DIR} UNIT_PREFIX=app-tour-staging \
  bash ${DEPLOY_ROOT}/tooling/scripts/vps-deploy/start-staging-artifact-stack.sh"

log "smoke four-process"
ssh_cmd "ENV_DIR=${ENV_DIR} UNIT_PREFIX=app-tour-staging \
  bash ${DEPLOY_ROOT}/tooling/scripts/vps-deploy/smoke-four-process.sh"

log "resource sample"
ssh_cmd 'uptime; free -h; swapon --show 2>/dev/null || true; \
  echo pnpm_count=$(ps -eo args= | grep -c "[p]npm" || true)'

log "DEPLOY_REMOTE_OK ${BASENAME}"
