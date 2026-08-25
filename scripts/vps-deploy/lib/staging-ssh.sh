#!/usr/bin/env bash
# Resolve SSH options for staging VPS (key file path or PEM in VPS_SSH_KEY).
set -euo pipefail

staging_ssh_setup() {
  STAGING_SSH_KEY_FILE="${STAGING_SSH_KEY_FILE:-}"
  SSH_IDENTITY_ARGS=()

  if [[ -n "${STAGING_SSH_KEY_FILE}" && -f "${STAGING_SSH_KEY_FILE}" ]]; then
    chmod 600 "${STAGING_SSH_KEY_FILE}"
    SSH_IDENTITY_ARGS=(-i "${STAGING_SSH_KEY_FILE}")
    return 0
  fi

  for candidate in \
    "${VPS_SSH_KEY:-}" \
    "${HOME}/.ssh/denali_staging" \
    "/home/ubuntu/.ssh/denali_staging" \
    "/home/hamed/.ssh/denali_staging"; do
    [[ -n "$candidate" && -f "$candidate" ]] || continue
    chmod 600 "$candidate"
    STAGING_SSH_KEY_FILE="$candidate"
    SSH_IDENTITY_ARGS=(-i "$candidate")
    return 0
  done

  if [[ -n "${VPS_SSH_KEY:-}" && "$VPS_SSH_KEY" == *"BEGIN"* ]]; then
    STAGING_SSH_KEY_FILE="$(mktemp)"
    chmod 600 "${STAGING_SSH_KEY_FILE}"
    printf '%s\n' "$VPS_SSH_KEY" >"${STAGING_SSH_KEY_FILE}"
    SSH_IDENTITY_ARGS=(-i "${STAGING_SSH_KEY_FILE}")
    return 0
  fi

  echo "staging-ssh: no SSH key — set VPS_SSH_KEY (PEM) or STAGING_SSH_KEY_FILE" >&2
  return 1
}

staging_ssh_cmd() {
  staging_ssh_setup
  ssh "${SSH_IDENTITY_ARGS[@]}" \
    -o ConnectTimeout=20 \
    -o StrictHostKeyChecking=no \
    "${VPS_USER:-root}@${VPS_HOST:?VPS_HOST required}" "$@"
}

staging_scp_cmd() {
  staging_ssh_setup
  scp "${SSH_IDENTITY_ARGS[@]}" \
    -o ConnectTimeout=20 \
    -o StrictHostKeyChecking=no \
    "$@"
}
