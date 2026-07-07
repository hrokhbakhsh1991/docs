#!/usr/bin/env bash
# P10-1-N-001 — HTTPS edge smoke (Profile C) after DNS + Caddy
# Requires: PLATFORM_ROOT_DOMAIN, CLUB_LABEL (default operator)
set -euo pipefail

ROOT_DOMAIN="${PLATFORM_ROOT_DOMAIN:-}"
CLUB="${CLUB_LABEL:-operator}"
VPS_HOST="${VPS_HOST:-}"

if [[ -z "$ROOT_DOMAIN" || "$ROOT_DOMAIN" == "staging.example.com" || "$ROOT_DOMAIN" == "localhost" ]]; then
  echo "P10_PROFILE_C_EDGE_SKIP: set PLATFORM_ROOT_DOMAIN to your real staging apex (not example.com/localhost)" >&2
  exit 0
fi

ADMIN_URL="https://${CLUB}.admin.${ROOT_DOMAIN}/auth/login"
PORTAL_URL="https://${CLUB}.portal.${ROOT_DOMAIN}/health"
MKT_URL="https://${CLUB}.${ROOT_DOMAIN}/health"

check() {
  local name=$1 url=$2
  local code
  code=$(curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 15 "$url" 2>/dev/null || echo "000")
  if [[ "$code" =~ ^[23] ]]; then
    echo "[p10-edge] ✓ $name OK (HTTP $code) — $url"
    return 0
  fi
  echo "[p10-edge] ✗ $name FAIL (HTTP $code) — $url" >&2
  return 1
}

echo "== p10:profile-c-edge-smoke root=${ROOT_DOMAIN} club=${CLUB} =="
fail=0
check admin "$ADMIN_URL" || fail=1
check portal "$PORTAL_URL" || fail=1
check marketing "$MKT_URL" || fail=1

if [[ "$fail" -ne 0 ]]; then
  echo "P10_PROFILE_C_EDGE_FAIL" >&2
  exit 1
fi

echo "P10_PROFILE_C_EDGE_OK"
