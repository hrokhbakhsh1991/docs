#!/usr/bin/env bash
# Phase L — start staging artifact units sequentially with health probes.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/ports.sh
source "${SCRIPT_DIR}/lib/ports.sh"

ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
UNIT_PREFIX="${UNIT_PREFIX:-app-tour-staging}"

log() { printf '[start-stack] %s\n' "$*"; }

collect_app_ports "$ENV_DIR"

wait_unit() {
  local unit="$1"
  local port="$2"
  local label="$3"
  log "start ${unit}"
  systemctl start "$unit"
  if ! wait_for_port_listen "$port" 60 2; then
    journalctl -u "$unit" -n 40 --no-pager >&2 || true
    echo "start-staging-artifact-stack: ${label} failed on :${port}" >&2
    exit 1
  fi
  log "${label} listening :${port}"
}

wait_unit "${UNIT_PREFIX}-api" "$API_PORT" "api"
curl -fsS "http://127.0.0.1:${API_PORT}/health" >/dev/null
log "api health OK"

wait_unit "${UNIT_PREFIX}-web" "$WEB_PORT" "web"
wait_unit "${UNIT_PREFIX}-portal" "$PORTAL_PORT" "portal"
wait_unit "${UNIT_PREFIX}-marketing" "$MARKETING_PORT" "marketing"

log "STACK_START_OK"
