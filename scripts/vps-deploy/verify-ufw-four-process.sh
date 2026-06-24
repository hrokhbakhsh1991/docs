#!/usr/bin/env bash
# P10 — verify app ports listen + optional UFW hints (G-OPS-05 lite)
set -euo pipefail

ENV_DIR="${ENV_DIR:-/etc/app-tour}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/ports.sh
source "${SCRIPT_DIR}/lib/ports.sh"

collect_app_ports "$ENV_DIR"

fail=0
for port in "$API_PORT" "$WEB_PORT" "${MARKETING_PORT:-}" "${PORTAL_PORT:-}"; do
  [[ -n "$port" ]] || continue
  if port_is_listening "$port"; then
    echo "[ufw-verify] :${port} LISTEN ✓"
  else
    echo "[ufw-verify] :${port} NOT LISTENING ✗" >&2
    fail=1
  fi
done

if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  echo "[ufw-verify] UFW active — Profile C should block public 3000-3003; allow 80/443 only"
  ufw status numbered 2>/dev/null | grep -E '80|443|'"${WEB_PORT}"'' || \
    echo "[ufw-verify] hint: ufw allow 80,443/tcp · restrict app ports to loopback when Profile C cutover"
else
  echo "[ufw-verify] UFW inactive or unavailable — document firewall in deploy/vps/README.md"
fi

if [[ "$fail" -ne 0 ]]; then
  echo "UFW_VERIFY_FAIL" >&2
  exit 1
fi

echo "UFW_VERIFY_OK"
