#!/usr/bin/env bash
# P10-3-N-001 ops drill — read-only staging/prod health sweep (no git rollback)
# Usage: VPS_HOST=89.45.89.206 pnpm run p10:ops-drill
set -euo pipefail

VPS_HOST="${VPS_HOST:-}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_PATH="${VPS_DEPLOY_PATH:-/opt/app-tour-staging}"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"

run_local_drill() {
  echo "== p10:ops-drill (local static) =="
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  test -f "$ROOT/docs/phase-23/runbooks/p10-incident-four-process.md"
  test -f "$ROOT/scripts/vps-deploy/rollback-vps.sh"
  ROLLBACK_DRY_RUN=1 DEPLOY_PATH="$ROOT" ENV_DIR="$ENV_DIR" \
    bash "$ROOT/scripts/vps-deploy/rollback-vps-dry-run.sh"
}

if [[ -z "$VPS_HOST" ]]; then
  run_local_drill
  echo "P10_OPS_DRILL_OK (local static only — set VPS_HOST for remote drill)"
  exit 0
fi

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=20)
if [[ -n "${VPS_SSH_KEY:-}" ]]; then
  KEY_FILE="$(mktemp)"
  trap 'rm -f "$KEY_FILE"' EXIT
  printf '%s\n' "$VPS_SSH_KEY" >"$KEY_FILE"
  chmod 600 "$KEY_FILE"
  SSH_OPTS+=(-i "$KEY_FILE")
fi

echo "== p10:ops-drill → ${VPS_USER}@${VPS_HOST} =="

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
DEPLOY="${DEPLOY_PATH}"
ENV="${ENV_DIR}"

echo "== INC-01..02 systemd =="
systemctl is-active caddy app-tour-staging-api app-tour-staging-web \
  app-tour-staging-marketing app-tour-staging-portal 2>/dev/null || \
  systemctl is-active app-tour-api app-tour-web app-tour-marketing app-tour-portal

echo "== smoke-four-process =="
ENV_DIR="\$ENV" bash "\$DEPLOY/scripts/vps-deploy/smoke-four-process.sh"

echo "== ufw-verify =="
ENV_DIR="\$ENV" bash "\$DEPLOY/scripts/vps-deploy/verify-ufw-four-process.sh"

echo "== rollback dry-run =="
ROLLBACK_DRY_RUN=1 DEPLOY_PATH="\$DEPLOY" ENV_DIR="\$ENV" \
  bash "\$DEPLOY/scripts/vps-deploy/rollback-vps-dry-run.sh"

if [[ -f /etc/caddy/caddy.env ]]; then
  echo "== caddy validate =="
  set -a && source /etc/caddy/caddy.env && set +a
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile 2>&1 | tail -1
fi
EOF

echo "P10_OPS_DRILL_OK"
