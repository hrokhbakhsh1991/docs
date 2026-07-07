#!/usr/bin/env bash
# P10-2-N-002 — remote four-process smoke via SSH (staging or production paths).
# GHA deploy-vps post-step · manual: VPS_HOST=… pnpm run p10:staging-remote-smoke
# @see docs/phase-23/appendices/P10-VERIFICATION-COMMANDS.yaml#P10-2-N-002
set -euo pipefail

VPS_USER="${VPS_USER:-root}"
DEPLOY_PATH="${VPS_DEPLOY_PATH:-/opt/app-tour-staging}"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
UNIT_PREFIX="${UNIT_PREFIX:-}"

if [[ -z "${VPS_HOST:-}" ]]; then
  echo "P10_REMOTE_GATE_FAIL: VPS_HOST not set" >&2
  exit 1
fi

if [[ -z "$UNIT_PREFIX" ]]; then
  if [[ "$ENV_DIR" == *staging* || "$DEPLOY_PATH" == *staging* ]]; then
    UNIT_PREFIX="app-tour-staging"
  else
    UNIT_PREFIX="app-tour"
  fi
fi

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=30)
if [[ -n "${VPS_SSH_KEY:-}" ]]; then
  KEY_FILE="$(mktemp)"
  trap 'rm -f "$KEY_FILE"' EXIT
  printf '%s\n' "$VPS_SSH_KEY" >"$KEY_FILE"
  chmod 600 "$KEY_FILE"
  SSH_OPTS+=(-i "$KEY_FILE")
fi

echo "== p10:staging-remote-gate → ${VPS_USER}@${VPS_HOST} (${UNIT_PREFIX}) =="

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
SMOKE='${DEPLOY_PATH}/scripts/vps-deploy/smoke-four-process.sh'
if [[ ! -f "\$SMOKE" ]]; then
  echo "P10_REMOTE_GATE_FAIL: missing \$SMOKE — rsync repo to VPS first (see TEMP/FOR YOU.md §C)" >&2
  exit 1
fi
export ENV_DIR='${ENV_DIR}'
export UNIT_PREFIX='${UNIT_PREFIX}'
bash "\$SMOKE"
EOF

echo "P10_REMOTE_GATE_OK"
