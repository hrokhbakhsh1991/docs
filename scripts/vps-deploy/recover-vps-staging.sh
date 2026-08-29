#!/usr/bin/env bash
# Phase A — recover touriran from resource starvation (console or SSH as root).
# Stops crash loops, kills runaway app-tour pnpm/node/next, prints health metrics.
set -euo pipefail

log() { printf '[recover-vps] %s\n' "$*"; }

[[ "$(id -u)" -eq 0 ]] || {
  echo "recover-vps-staging: run as root" >&2
  exit 1
}

UNITS=(
  app-tour-api app-tour-web app-tour-marketing app-tour-portal
  app-tour-staging-api app-tour-staging-web app-tour-staging-marketing app-tour-staging-portal
)

log "stop + disable app-tour units"
for u in "${UNITS[@]}"; do
  systemctl stop "$u" 2>/dev/null || true
  systemctl disable "$u" 2>/dev/null || true
  systemctl reset-failed "$u" 2>/dev/null || true
done

log "kill runaway app-tour pnpm/node/next (scoped — not global pkill)"
while read -r pid cmd; do
  [[ -z "${pid:-}" ]] && continue
  case "$cmd" in
    *app-tour*|*/opt/app-tour*|*/opt/app-tour-staging*)
      kill -TERM "$pid" 2>/dev/null || true
      ;;
  esac
done < <(ps -eo pid=,args= | grep -E 'pnpm|node|next' | grep -E 'app-tour|/opt/app-tour' | grep -v grep || true)

sleep 3
while read -r pid cmd; do
  [[ -z "${pid:-}" ]] && continue
  case "$cmd" in
    *app-tour*|*/opt/app-tour*|*/opt/app-tour-staging*)
      kill -KILL "$pid" 2>/dev/null || true
      ;;
  esac
done < <(ps -eo pid=,args= | grep -E 'pnpm|node|next' | grep -E 'app-tour|/opt/app-tour' | grep -v grep || true)

PNPM_COUNT="$(ps -eo args= | grep -c '[p]npm' || true)"
APP_NODE_COUNT="$(ps -eo args= | grep -E '[n]ode|[n]ext' | grep -cE 'app-tour|/opt/app-tour' || true)"

log "=== metrics ==="
uptime
free -h
swapon --show 2>/dev/null || true
echo "pnpm_count=${PNPM_COUNT}"
echo "app_tour_node_count=${APP_NODE_COUNT}"
df -h / /opt /tmp 2>/dev/null || df -h /

if [[ "$PNPM_COUNT" -gt 0 ]]; then
  log "WARN: pnpm still running — inspect: ps aux | grep pnpm"
fi

if free -m | awk '/^Mem:/{print $7}' | grep -qE '^[0-9]+$' && [[ "$(free -m | awk '/^Mem:/{print $7}')" -lt 2048 ]]; then
  log "WARN: available RAM < 2 GiB — wait before deploy"
fi

log "recover complete — require 3 consecutive SSH successes before artifact deploy"
