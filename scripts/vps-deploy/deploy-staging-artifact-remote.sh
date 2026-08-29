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
EXPECTED_SHA="$(awk '{print $1}' "${ARTIFACT}.sha256")"

log() { printf '[deploy-remote] %s\n' "$*"; }

ssh_cmd() {
  staging_ssh_cmd "$@"
}

scp_with_retry() {
  local attempt
  local status
  for attempt in 1 2 3; do
    set +e
    staging_scp_cmd "$@"
    status=$?
    set -e
    if [[ "$status" -eq 0 ]]; then
      return 0
    fi
    log "scp attempt ${attempt}/3 failed; retrying"
    sleep $((attempt * 2))
  done
  return "$status"
}

remote_sha_for() {
  local remote_path="$1"
  local remote_path_q
  remote_path_q="$(printf '%q' "$remote_path")"
  ssh_cmd "if [[ -f ${remote_path_q} ]]; then sha256sum ${remote_path_q} | awk '{print \$1}'; fi"
}

transfer_artifact() {
  local remote_artifact="/tmp/app-tour-artifacts/${BASENAME}"
  local remote_artifact_q
  remote_artifact_q="$(printf '%q' "$remote_artifact")"
  local chunk_size="${STAGING_ARTIFACT_CHUNK_SIZE:-8m}"

  if [[ "$(remote_sha_for "$remote_artifact")" == "$EXPECTED_SHA" ]]; then
    log "artifact already present with matching checksum"
    scp_with_retry "${ARTIFACT}.sha256" "${REMOTE}:/tmp/app-tour-artifacts/"
    return 0
  fi

  local chunk_dir
  chunk_dir="$(mktemp -d)"
  split -d -a 5 -b "$chunk_size" "$ARTIFACT" "${chunk_dir}/${BASENAME}.part."

  local remote_parts="/tmp/app-tour-artifacts/${BASENAME}.${EXPECTED_SHA}.parts"
  local remote_parts_q
  remote_parts_q="$(printf '%q' "$remote_parts")"
  ssh_cmd "mkdir -p ${remote_parts_q}"

  local part
  for part in "${chunk_dir}"/*; do
    upload_verified_chunk "$part" "$remote_parts"
  done

  reassemble_verified_chunks "$chunk_dir" "$remote_parts" "$remote_artifact"
  scp_with_retry "${ARTIFACT}.sha256" "${REMOTE}:/tmp/app-tour-artifacts/"

  local remote_sha
  remote_sha="$(remote_sha_for "$remote_artifact")"
  if [[ "$remote_sha" != "$EXPECTED_SHA" ]]; then
    rm -rf "$chunk_dir"
    echo "deploy-staging-artifact-remote: checksum mismatch after transfer: ${remote_sha}" >&2
    return 1
  fi
  rm -rf "$chunk_dir"
}

upload_verified_chunk() {
  local part="$1"
  local remote_parts="$2"
  local name
  name="$(basename "$part")"
  local expected_part_sha
  expected_part_sha="$(sha256sum "$part" | awk '{print $1}')"
  local remote_part="${remote_parts}/${name}"
  local remote_part_q
  remote_part_q="$(printf '%q' "$remote_part")"
  local remote_parts_q
  remote_parts_q="$(printf '%q' "$remote_parts")"
  local tmp_part="${remote_part}.uploading"
  local tmp_part_q
  tmp_part_q="$(printf '%q' "$tmp_part")"
  local existing_sha
  existing_sha="$(remote_sha_for "$remote_part")"
  if [[ "$existing_sha" == "$expected_part_sha" ]]; then
    log "chunk ${name} already verified; skip"
    return 0
  fi

  local attempt
  local status
  for attempt in 1 2 3; do
    log "upload chunk ${name} attempt ${attempt}/3"
    ssh_cmd "mkdir -p ${remote_parts_q} && rm -f ${tmp_part_q}"
    set +e
    staging_scp_cmd "$part" "${REMOTE}:${tmp_part}"
    status=$?
    set -e
    if [[ "$status" -eq 0 ]]; then
      local uploaded_sha
      uploaded_sha="$(remote_sha_for "$tmp_part")"
      if [[ "$uploaded_sha" == "$expected_part_sha" ]]; then
        ssh_cmd "mv ${tmp_part_q} ${remote_part_q}"
        log "chunk ${name} verified"
        return 0
      fi
      log "chunk ${name} sha mismatch after upload: ${uploaded_sha:-missing}"
    else
      log "chunk ${name} upload failed with status ${status}"
    fi
    if [[ "$attempt" -lt 3 ]]; then
      ssh_cmd 'echo SSH_RETRY_OK >/dev/null'
      sleep $((attempt * 2))
    fi
  done

  echo "deploy-staging-artifact-remote: chunk ${name} failed after 3 attempts; verified chunks preserved in ${remote_parts}" >&2
  return 1
}

reassemble_verified_chunks() {
  local chunk_dir="$1"
  local remote_parts="$2"
  local remote_artifact="$3"
  local assembling="${remote_artifact}.assembling"
  local assembling_q
  assembling_q="$(printf '%q' "$assembling")"
  local remote_artifact_q
  remote_artifact_q="$(printf '%q' "$remote_artifact")"
  local remote_parts_q
  remote_parts_q="$(printf '%q' "$remote_parts")"

  local remote_cat='cat'
  local part
  for part in "${chunk_dir}"/*; do
    local remote_part_q
    remote_part_q="$(printf '%q' "${remote_parts}/$(basename "$part")")"
    remote_cat+=" ${remote_part_q}"
  done

  ssh_cmd "${remote_cat} > ${assembling_q}"
  local assembled_sha
  assembled_sha="$(remote_sha_for "$assembling")"
  if [[ "$assembled_sha" != "$EXPECTED_SHA" ]]; then
    echo "deploy-staging-artifact-remote: assembled checksum mismatch: ${assembled_sha:-missing}" >&2
    return 1
  fi
  ssh_cmd "mv ${assembling_q} ${remote_artifact_q} && rm -rf ${remote_parts_q}"
}

log "preflight SSH"
ssh_cmd 'echo SSH_OK; uptime; free -h | head -2'

log "remote prerequisites (zstd)"
scp_with_retry "${SCRIPT_DIR}/ensure-staging-artifact-prerequisites.sh" \
  "${REMOTE}:${DEPLOY_ROOT}/tooling/scripts/vps-deploy/"
ssh_cmd "chmod +x ${DEPLOY_ROOT}/tooling/scripts/vps-deploy/ensure-staging-artifact-prerequisites.sh && \
  bash ${DEPLOY_ROOT}/tooling/scripts/vps-deploy/ensure-staging-artifact-prerequisites.sh"

log "transfer artifact + checksum"
ssh_cmd "mkdir -p /tmp/app-tour-artifacts ${DEPLOY_ROOT}/tooling/scripts/vps-deploy/lib"
transfer_artifact
if [[ "${STAGING_ARTIFACT_TRANSFER_ONLY:-0}" == "1" ]]; then
  log "TRANSFER_ONLY_OK ${BASENAME}"
  exit 0
fi
for f in start-api-artifact.sh start-next-artifact.sh install-staging-artifact.sh \
  start-staging-artifact-stack.sh recover-vps-staging.sh smoke-four-process.sh \
  sync-staging-surface-auth-env.sh probe-staging-minio.sh seed-staging-artifact.sh \
  ensure-staging-artifact-prerequisites.sh ensure-staging-jwt-keys.sh \
  sync-staging-profile-b-public-urls.sh retain-staging-artifact-history.sh; do
  scp_with_retry "${SCRIPT_DIR}/${f}" "${REMOTE}:${DEPLOY_ROOT}/tooling/scripts/vps-deploy/"
done
for f in ports.sh staging-ssh.sh artifact-self-check.sh; do
  scp_with_retry "${SCRIPT_DIR}/lib/${f}" "${REMOTE}:${DEPLOY_ROOT}/tooling/scripts/vps-deploy/lib/${f}"
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

log "retain staging release/artifact history"
ssh_cmd "DEPLOY_ROOT=${DEPLOY_ROOT} RETAIN_RELEASES=${RETAIN_RELEASES:-3} \
  bash ${DEPLOY_ROOT}/tooling/scripts/vps-deploy/retain-staging-artifact-history.sh"

log "resource sample"
ssh_cmd 'uptime; free -h; swapon --show 2>/dev/null || true; \
  echo pnpm_count=$(ps -eo args= | grep -c "[p]npm" || true)'

log "DEPLOY_REMOTE_OK ${BASENAME}"
