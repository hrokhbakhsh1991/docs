#!/usr/bin/env bash
# P10-2-N-001 — Smoke test all 4 processes (api, web, marketing, portal)
# Proof tier: PROFILE_C
# Gap: G-DEP-01, G-DEP-09

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/ports.sh
source "${SCRIPT_DIR}/lib/ports.sh"

ENV_DIR="${ENV_DIR:-/etc/app-tour}"
MAX_ATTEMPTS="${SMOKE_ATTEMPTS:-30}"
SLEEP_SEC="${SMOKE_SLEEP_SEC:-2}"

if [[ -z "${UNIT_PREFIX:-}" ]]; then
  if [[ "$ENV_DIR" == *staging* ]]; then
    UNIT_PREFIX="app-tour-staging"
  else
    UNIT_PREFIX="app-tour"
  fi
fi

# Collect ports from env files
collect_app_ports "$ENV_DIR"

API_PORT="${API_PORT:-3001}"
WEB_PORT="${WEB_PORT:-3000}"
MARKETING_PORT="${MARKETING_PORT:-3002}"
PORTAL_PORT="${PORTAL_PORT:-3003}"

if [[ ! -f "${ENV_DIR}/marketing.env" || ! -f "${ENV_DIR}/portal.env" ]]; then
  echo "[smoke-4] ✗ marketing.env and portal.env required for four-process smoke (ENV_DIR=${ENV_DIR})" >&2
  exit 1
fi

# Health endpoints
API_URL="http://127.0.0.1:${API_PORT}/health"
WEB_URL="http://127.0.0.1:${WEB_PORT}/auth/login"
MARKETING_URL="http://127.0.0.1:${MARKETING_PORT}/health"
PORTAL_URL="http://127.0.0.1:${PORTAL_PORT}/health"

echo "[smoke-4] Testing 4 processes: api(:${API_PORT}) web(:${WEB_PORT}) marketing(:${MARKETING_PORT}) portal(:${PORTAL_PORT})"

check_service() {
  local name=$1
  local url=$2
  local http_code

  http_code=$(curl -sS -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")

  if [[ "$http_code" =~ ^[23] ]]; then
    echo "[smoke-4] ✓ $name OK (HTTP $http_code)"
    return 0
  else
    echo "[smoke-4] ✗ $name FAIL (HTTP $http_code) — $url" >&2
    return 1
  fi
}

log_service_status() {
  echo "[smoke-4] Service status:" >&2
  for unit in "${UNIT_PREFIX}-api" "${UNIT_PREFIX}-web" "${UNIT_PREFIX}-marketing" "${UNIT_PREFIX}-portal"; do
    if command -v systemctl >/dev/null 2>&1; then
      echo "[smoke-4] $unit:" >&2
      systemctl --no-pager -l status "$unit" 2>&1 | tail -8 >&2 || true
    fi
  done

  echo "[smoke-4] Listening ports:" >&2
  if command -v ss >/dev/null 2>&1; then
    for port in "$API_PORT" "$WEB_PORT" "$MARKETING_PORT" "$PORTAL_PORT"; do
      if port_is_listening "$port"; then
        echo "[smoke-4]   :${port} LISTEN ✓" >&2
      else
        echo "[smoke-4]   :${port} NOT LISTENING ✗" >&2
      fi
    done
  fi
}

# Retry loop
for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  api_ok=0
  web_ok=0
  marketing_ok=0
  portal_ok=0

  # Check all 4 services
  check_service "api" "$API_URL" && api_ok=1 || true
  check_service "web" "$WEB_URL" && web_ok=1 || true
  check_service "marketing" "$MARKETING_URL" && marketing_ok=1 || true
  check_service "portal" "$PORTAL_URL" && portal_ok=1 || true

  # Success if all 4 are OK
  if [[ "$api_ok" -eq 1 && "$web_ok" -eq 1 && "$marketing_ok" -eq 1 && "$portal_ok" -eq 1 ]]; then
    echo "[smoke-4] ✓ All 4 processes healthy (attempt $attempt/$MAX_ATTEMPTS)"
    echo "SMOKE_FOUR_PROCESS_OK"
    exit 0
  fi

  echo "[smoke-4] Attempt $attempt/$MAX_ATTEMPTS — waiting ${SLEEP_SEC}s..." >&2
  sleep "$SLEEP_SEC"
done

# Failed
echo "[smoke-4] ✗ FAILED — Not all processes healthy after $MAX_ATTEMPTS attempts" >&2
echo "[smoke-4] Expected:" >&2
echo "[smoke-4]   api:       $API_URL" >&2
echo "[smoke-4]   web:       $WEB_URL" >&2
echo "[smoke-4]   marketing: $MARKETING_URL" >&2
echo "[smoke-4]   portal:    $PORTAL_URL" >&2

log_service_status
exit 1

# Made with Bob
