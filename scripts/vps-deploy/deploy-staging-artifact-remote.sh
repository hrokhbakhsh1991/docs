#!/usr/bin/env bash
# Transfer built artifact to VPS and install (no pnpm install/build on VPS).
#
#   VPS_HOST=89.42.210.252 VPS_USER=root \
#   ARTIFACT=dist/staging-artifacts/app-tour-staging-<sha>.tar.zst \
#   bash scripts/vps-deploy/deploy-staging-artifact-remote.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/staging-ssh.sh
source "${SCRIPT_DIR}/lib/staging-ssh.sh"

VPS_HOST="${VPS_HOST:?VPS_HOST required}"
VPS_USER="${VPS_USER:-root}"
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
  staging_ssh_cmd "$@"
}

log "preflight SSH"
ssh_cmd 'echo SSH_OK; uptime; free -h | head -2'

log "remote prerequisites (zstd)"
staging_scp_cmd "${SCRIPT_DIR}/ensure-staging-artifact-prerequisites.sh" \
  "${REMOTE}:${DEPLOY_ROOT}/tooling/scripts/vps-deploy/"
ssh_cmd "chmod +x ${DEPLOY_ROOT}/tooling/scripts/vps-deploy/ensure-staging-artifact-prerequisites.sh && \
  bash ${DEPLOY_ROOT}/tooling/scripts/vps-deploy/ensure-staging-artifact-prerequisites.sh"

log "transfer artifact + checksum"
ssh_cmd "mkdir -p /tmp/app-tour-artifacts ${DEPLOY_ROOT}/tooling/scripts/vps-deploy/lib"
staging_scp_cmd "$ARTIFACT" "${ARTIFACT}.sha256" "${REMOTE}:/tmp/app-tour-artifacts/"
for f in start-api-artifact.sh start-next-artifact.sh install-staging-artifact.sh \
  start-staging-artifact-stack.sh recover-vps-staging.sh smoke-four-process.sh \
  sync-staging-surface-auth-env.sh probe-staging-minio.sh seed-staging-artifact.sh \
  ensure-staging-artifact-prerequisites.sh ensure-staging-jwt-keys.sh \
  sync-staging-profile-b-public-urls.sh; do
  staging_scp_cmd "${SCRIPT_DIR}/${f}" "${REMOTE}:${DEPLOY_ROOT}/tooling/scripts/vps-deploy/"
done
for f in ports.sh staging-ssh.sh artifact-self-check.sh; do
  staging_scp_cmd "${SCRIPT_DIR}/lib/${f}" "${REMOTE}:${DEPLOY_ROOT}/tooling/scripts/vps-deploy/lib/${f}"
done

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

log "minio live probe"
ssh_cmd "ENV_DIR=${ENV_DIR} bash ${DEPLOY_ROOT}/tooling/scripts/vps-deploy/probe-staging-minio.sh"

log "resource sample"
ssh_cmd 'uptime; free -h; swapon --show 2>/dev/null || true; \
  echo pnpm_count=$(ps -eo args= | grep -c "[p]npm" || true)'

log "DEPLOY_REMOTE_OK ${BASENAME}"
