#!/usr/bin/env bash
# Denali Wallet v1 — staging verification (loopback; no secrets logged).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/ports.sh
source "${SCRIPT_DIR}/lib/ports.sh"

ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/app-tour-staging}"
UNIT_PREFIX="${UNIT_PREFIX:-app-tour-staging}"

DENALI_WALLET_PILOT_TENANT_ID="${DENALI_WALLET_PILOT_TENANT_ID:-00000000-0000-4000-8000-000000000430}"
DENALI_WALLET_ADMIN_HOST="${DENALI_WALLET_ADMIN_HOST:-}"
DENALI_WALLET_PORTAL_HOST="${DENALI_WALLET_PORTAL_HOST:-}"
DENALI_WALLET_NON_PILOT_ADMIN_HOST="${DENALI_WALLET_NON_PILOT_ADMIN_HOST:-}"

log() { printf '[wallet-staging-verify] %s\n' "$*"; }
fail() { printf '[wallet-staging-verify] FAIL: %s\n' "$*" >&2; exit 1; }

collect_app_ports "$ENV_DIR"

API_HEALTH="http://127.0.0.1:${API_PORT}/health"
WEB_LOGIN="http://127.0.0.1:${WEB_PORT}/auth/login"
PORTAL_HEALTH="http://127.0.0.1:${PORTAL_PORT}/health"

log "service health"
api_code="$(curl -sS -o /tmp/wallet-verify-api.json -w "%{http_code}" "$API_HEALTH" 2>/dev/null || echo 000)"
[[ "$api_code" == "200" ]] || fail "api health HTTP ${api_code}"
if grep -q '"database"' /tmp/wallet-verify-api.json 2>/dev/null; then
  log "api health OK (database check present)"
else
  log "api health OK"
fi

web_code="$(curl -sS -o /dev/null -w "%{http_code}" "$WEB_LOGIN" 2>/dev/null || echo 000)"
[[ "$web_code" =~ ^[23] ]] || fail "web login surface HTTP ${web_code}"
log "web reachability OK (HTTP ${web_code})"

[[ -n "$PORTAL_PORT" ]] || fail "portal.env missing — PORTAL_PORT unknown"
portal_code="$(curl -sS -o /dev/null -w "%{http_code}" "$PORTAL_HEALTH" 2>/dev/null || echo 000)"
[[ "$portal_code" =~ ^[23] ]] || fail "portal health HTTP ${portal_code}"
log "portal reachability OK (HTTP ${portal_code})"

if [[ -f "${ENV_DIR}/api.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "${ENV_DIR}/api.env"
  set +a
fi

if [[ -n "${DATABASE_URL_ADMIN:-}" && -f "${DEPLOY_ROOT}/current/prisma-migrate/node_modules/prisma/build/index.js" ]]; then
  log "migration status (prisma migrate status)"
  export DATABASE_URL="${DATABASE_URL_ADMIN}"
  if sudo -u "${APP_USER:-app-tour}" env HOME="$DEPLOY_ROOT" \
    node "${DEPLOY_ROOT}/current/prisma-migrate/node_modules/prisma/build/index.js" \
    migrate status --schema="${DEPLOY_ROOT}/current/api/prisma/schema.prisma" 2>&1 | tail -5; then
    log "migration status command completed"
  else
    log "migration status unavailable — check release artifact prisma-migrate bundle"
  fi
elif [[ -n "${DATABASE_URL_ADMIN:-}" && -f "${DEPLOY_ROOT}/current/api/prisma/schema.prisma" ]]; then
  log "migration status skipped — prisma CLI bundle missing (non-fatal)"
fi

tenant_config_check() {
  local host="$1"
  local expect_wallet="$2"
  local label="$3"
  [[ -n "$host" ]] || return 0

  local url="http://127.0.0.1:${API_PORT}/api/v2/tenant-config"
  local body_file="/tmp/wallet-verify-tenant-config-${label}.json"
  local code
  code="$(curl -sS -o "$body_file" -w "%{http_code}" \
    -H "Host: ${host}" \
    -H "x-forwarded-host: ${host}" \
    "$url" 2>/dev/null || echo 000)"
  [[ "$code" == "200" ]] || fail "${label} tenant-config HTTP ${code} for Host ${host}"

  if [[ "$expect_wallet" == "enabled" ]]; then
    grep -q '"wallet"' "$body_file" || fail "${label} tenant-config missing wallet in enabledModules"
    log "${label} tenant-config wallet enabled OK"
  else
    if grep -q '"enabledModules".*"wallet"' "$body_file" 2>/dev/null; then
      fail "${label} tenant-config unexpectedly includes wallet module"
    fi
    log "${label} tenant-config wallet disabled OK"
  fi
}

tenant_config_check "$DENALI_WALLET_ADMIN_HOST" "enabled" "pilot-admin"
tenant_config_check "$DENALI_WALLET_NON_PILOT_ADMIN_HOST" "disabled" "non-pilot-admin"

log "systemd active state"
for unit in "${UNIT_PREFIX}-api" "${UNIT_PREFIX}-web" "${UNIT_PREFIX}-portal"; do
  if command -v systemctl >/dev/null 2>&1; then
    systemctl is-active --quiet "$unit" || fail "unit not active: ${unit}"
    log "${unit} active"
  fi
done

log "WALLET_STAGING_VERIFY_OK"
