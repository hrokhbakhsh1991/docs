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
  echo "[ufw-verify] Policy guidance — block public app ports; allow 80 for Arvan HTTP origin; keep private-staging 443 closed publicly. Current matching rules:"
  ufw status numbered 2>/dev/null | grep -E '80|443|'"${WEB_PORT}"'' || \
    echo "[ufw-verify] hint: allow only required ingress; never open 443 globally for private .staging.test routes"
else
  echo "[ufw-verify] UFW inactive or unavailable — document firewall in deploy/vps/README.md"
fi

if [[ "$fail" -ne 0 ]]; then
  echo "UFW_VERIFY_FAIL" >&2
  exit 1
fi

echo "UFW_VERIFY_OK"
