#!/usr/bin/env bash
# Resolve SSH options for staging VPS (key file path or PEM in VPS_SSH_KEY).
set -euo pipefail

STAGING_SSH_CONTROL_DIR="${STAGING_SSH_CONTROL_DIR:-${TMPDIR:-/tmp}/app-tour-staging-ssh}"
STAGING_SSH_CONTROL_PATH="${STAGING_SSH_CONTROL_PATH:-${STAGING_SSH_CONTROL_DIR}/%C}"

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

staging_ssh_target() {
  printf '%s@%s' "${VPS_USER:-root}" "${VPS_HOST:?VPS_HOST required}"
}

staging_ssh_mux_args() {
  staging_ssh_setup
  mkdir -p "$STAGING_SSH_CONTROL_DIR"
  STAGING_SSH_MUX_ARGS=(
    "${SSH_IDENTITY_ARGS[@]}"
    -o ConnectTimeout=30
    -o ServerAliveInterval=15
    -o ServerAliveCountMax=6
    -o StrictHostKeyChecking=no
    -o BatchMode=yes
    -o ControlMaster=auto
    -o "ControlPath=${STAGING_SSH_CONTROL_PATH}"
    -o ControlPersist=600
  )
}

# One persistent TCP session for all scp/ssh — avoids GHA→VPS connection storms.
staging_ssh_open_master() {
  staging_ssh_mux_args
  local target
  target="$(staging_ssh_target)"
  if ssh "${STAGING_SSH_MUX_ARGS[@]}" -O check "$target" 2>/dev/null; then
    return 0
  fi
  ssh "${STAGING_SSH_MUX_ARGS[@]}" -fN "$target"
}

staging_ssh_close_master() {
  staging_ssh_mux_args || return 0
  local target
  target="$(staging_ssh_target)"
  ssh "${STAGING_SSH_MUX_ARGS[@]}" -O exit "$target" 2>/dev/null || true
}

staging_ssh_cmd() {
  staging_ssh_mux_args
  ssh "${STAGING_SSH_MUX_ARGS[@]}" "$(staging_ssh_target)" "$@"
}

staging_scp_cmd() {
  staging_ssh_mux_args
  scp -O "${STAGING_SSH_MUX_ARGS[@]}" "$@"
}
