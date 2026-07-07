#!/usr/bin/env bash
# P1 opt-in live provision smoke — POST /platform/v1/tenants → 201 + tenant/sites/invite
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

if [[ -z "${DATABASE_URL:-}" || -z "${DATABASE_URL_ADMIN:-}" ]]; then
  echo "P1 live provision smoke: SKIP (DATABASE_URL and DATABASE_URL_ADMIN required)"
  exit 0
fi

API_BASE="${P1_API_BASE:-${API_BASE:-http://127.0.0.1:3001}}"
API_BASE="${API_BASE%/}"
HEALTH_URL="${API_BASE}/health"

if ! curl -sf --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
  if [[ "${P1_SPAWN_API:-}" != "1" ]]; then
    echo "P1 live provision smoke: SKIP (API not reachable at ${API_BASE}; set P1_SPAWN_API=1 to spawn dev API)"
    exit 0
  fi

  echo "P1 live provision smoke: spawning temporary API at ${API_BASE}..."
  pnpm --filter @apps/api run db:migrate:deploy >/dev/null
  NODE_ENV=development STORAGE_DRIVER="${STORAGE_DRIVER:-memory}" \
    AUTH_ALLOW_DEV_STATIC_OTP=true \
    PLATFORM_OPS_PHONES="${PLATFORM_OPS_PHONE:-+989121234567}" \
    PLATFORM_ROOT_DOMAIN="${PLATFORM_ROOT_DOMAIN:-localhost}" \
    PORT="${P1_API_PORT:-3001}" \
    pnpm --filter @apps/api run dev &
  API_PID=$!
  trap 'kill "$API_PID" 2>/dev/null || true' EXIT

  for _ in $(seq 1 60); do
    if curl -sf --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done
  if ! curl -sf --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
    echo "P1 live provision smoke: FAIL — API did not become healthy at ${API_BASE}" >&2
    exit 1
  fi
fi

export API_BASE
export PLATFORM_OPS_PHONE="${PLATFORM_OPS_PHONE:-+989121234567}"
node apps/api/scripts/smoke-platform-provision.mjs
echo "P1_LIVE_PROVISION_SMOKE_OK"
