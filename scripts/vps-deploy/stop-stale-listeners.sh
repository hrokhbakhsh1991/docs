#!/usr/bin/env bash
# Stop systemd units and release app-tour listener ports before a clean restart.
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/app-tour}"
ENV_DIR="${ENV_DIR:-/etc/app-tour}"
APP_USER="${APP_USER:-app-tour}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/ports.sh
source "${SCRIPT_DIR}/lib/ports.sh"

log() {
  printf '[stop-stale] %s\n' "$*"
}

should_stop_pid() {
  local pid="$1"
  [[ -d "/proc/${pid}" ]] || return 1
  local owner cmdline
  owner="$(stat -c '%U' "/proc/${pid}" 2>/dev/null || true)"
  if [[ "$owner" == "$APP_USER" ]]; then
    return 0
  fi
  cmdline="$(tr '\0' ' ' <"/proc/${pid}/cmdline" 2>/dev/null || true)"
  [[ "$cmdline" == *"${DEPLOY_PATH}"* ]]
}

stop_pid_gracefully() {
  local pid="$1"
  if ! should_stop_pid "$pid"; then
    log "skip pid ${pid} (not ${APP_USER} / ${DEPLOY_PATH})"
    return 0
  fi
  log "stop pid ${pid}"
  kill -TERM "$pid" 2>/dev/null || true
  for _ in $(seq 1 10); do
    [[ -d "/proc/${pid}" ]] || return 0
    sleep 0.5
  done
  kill -KILL "$pid" 2>/dev/null || true
}

if command -v systemctl >/dev/null 2>&1; then
  systemctl stop app-tour-api.service app-tour-web.service app-tour-marketing.service app-tour-portal.service 2>/dev/null || true
  sleep 1
fi

collect_app_ports "$ENV_DIR"
for port in "${APP_PORTS[@]}"; do
  mapfile -t pids < <(pids_listening_on_port "$port" || true)
  if [[ "${#pids[@]}" -eq 0 ]]; then
    continue
  fi
  log "port ${port} listeners: ${pids[*]:-none}"
  for pid in "${pids[@]}"; do
    [[ -n "$pid" ]] || continue
    stop_pid_gracefully "$pid"
  done
done

sleep 1
log "done"
