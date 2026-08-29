#!/usr/bin/env bash
# Paste into VPS provider console as root (Steps 0–5).
# Recovers from failed source-build (pnpm install) before artifact deploy.
# Does NOT run pnpm install/build. Does NOT touch DB/MinIO/env/releases.
set -euo pipefail

log() { printf '[console-recovery] %s\n' "$*"; }

[[ "$(id -u)" -eq 0 ]] || {
  echo "run as root on touriran console" >&2
  exit 1
}

log "=== STEP 0 — inspect ==="
hostname
uptime
free -h
swapon --show 2>/dev/null || true
df -h / /opt /tmp 2>/dev/null || df -h /
echo "pnpm_count=$(pgrep -c -f pnpm 2>/dev/null || echo 0)"
pgrep -af pnpm 2>/dev/null | head -20 || true
ps aux --sort=-%cpu | head -15
ps aux --sort=-%mem | head -15
systemctl list-units --all 'app-tour*' 2>/dev/null || systemctl list-units --all | grep app-tour || true

UNITS=(
  app-tour-api app-tour-web app-tour-marketing app-tour-portal
  app-tour-staging-api app-tour-staging-web app-tour-staging-marketing app-tour-staging-portal
)

log "=== STEP 1 — stop all app-tour units ==="
for u in "${UNITS[@]}"; do
  systemctl stop "$u" 2>/dev/null || true
  systemctl disable "$u" 2>/dev/null || true
  systemctl reset-failed "$u" 2>/dev/null || true
done
systemctl daemon-reload

log "=== STEP 2 — kill failed build processes (scoped) ==="
while read -r pid cmd; do
  [[ -z "${pid:-}" ]] && continue
  case "$cmd" in
    *app-tour*|*/opt/app-tour*|*/opt/app-tour-staging*)
      kill -TERM "$pid" 2>/dev/null || true
      ;;
  esac
done < <(ps -eo pid=,args= | grep -E 'pnpm|node|next' | grep -E 'app-tour|/opt/app-tour' | grep -v grep || true)
sleep 5
while read -r pid cmd; do
  [[ -z "${pid:-}" ]] && continue
  case "$cmd" in
    *app-tour*|*/opt/app-tour*|*/opt/app-tour-staging*)
      kill -KILL "$pid" 2>/dev/null || true
      ;;
  esac
done < <(ps -eo pid=,args= | grep -E 'pnpm|node|next' | grep -E 'app-tour|/opt/app-tour' | grep -v grep || true)

PNPM_COUNT="$(pgrep -c -f pnpm 2>/dev/null || echo 0)"
log "pnpm_count=${PNPM_COUNT}"
if [[ "$PNPM_COUNT" -gt 0 ]]; then
  log "ERROR: pnpm still running — inspect pgrep -af pnpm" >&2
  exit 1
fi

log "=== STEP 3 — resource recovery (wait 30s) ==="
sleep 30
uptime
free -h
AVAIL_MB="$(free -m | awk '/^Mem:/{print $7}')"
log "available_ram_mb=${AVAIL_MB}"
if [[ "$AVAIL_MB" -lt 2048 ]]; then
  log "WARN: available RAM < 2 GiB — wait longer before deploy"
fi

log "=== STEP 4 — sshd sanity (do not restart unless hung after recovery) ==="
systemctl is-active ssh 2>/dev/null || systemctl is-active sshd 2>/dev/null || true
sshd -t 2>/dev/null && log "sshd -t OK" || log "WARN: sshd -t failed"
if command -v fail2ban-client >/dev/null 2>&1; then
  fail2ban-client status sshd 2>/dev/null || true
fi

log "=== STEP 5 — optional partial source-build cleanup ==="
STAGING_ROOT="/opt/app-tour-staging"
if [[ "${CLEAN_PARTIAL:-}" == "1" ]]; then
  for path in "${STAGING_ROOT}/node_modules" "${STAGING_ROOT}/apps" "${STAGING_ROOT}/packages"; do
    if [[ -e "$path" && ! -L "$path" ]]; then
      log "remove partial ${path}"
      rm -rf "$path"
    fi
  done
else
  log "skip partial cleanup (set CLEAN_PARTIAL=1 to remove failed D4 node_modules)"
fi

log "=== RECOVERY DONE ==="
log "From build host, verify 3× SSH then:"
log "  VPS_HOST=89.42.210.252 ARTIFACT=dist/staging-artifacts/app-tour-staging-b87bd4ef....tar.zst pnpm run deploy:staging:artifact:remote"
