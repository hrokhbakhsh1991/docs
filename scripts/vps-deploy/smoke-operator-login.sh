#!/usr/bin/env bash
# Post-deploy smoke — DB probe, /health, operator OTP BFF.
set -euo pipefail

ENV_DIR="${ENV_DIR:-/etc/app-tour}"

read_env_value() {
  local file="$1" key="$2"
  if [[ -f "$file" ]]; then
    grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' || true
  fi
}

resolve_smoke_phone() {
  if [[ -n "${SMOKE_OPERATOR_PHONE:-}" ]]; then
    printf '%s' "$SMOKE_OPERATOR_PHONE"
    return
  fi
  local from_api
  from_api="$(read_env_value "${ENV_DIR}/api.env" OPERATOR_OWNER_MOBILE)"
  if [[ -n "$from_api" ]]; then
    printf '%s' "$from_api"
    return
  fi
  printf '%s' "+15550001001"
}

SMOKE_PHONE="$(resolve_smoke_phone)"

resolve_smoke_admin_host() {
  if [[ -n "${SMOKE_OPERATOR_ADMIN_HOST:-}" ]]; then
    printf '%s' "$SMOKE_OPERATOR_ADMIN_HOST"
    return
  fi

  local api_env="${ENV_DIR}/api.env"
  local fallback_hosts
  fallback_hosts="$(read_env_value "$api_env" PUBLIC_TENANT_FALLBACK_HOSTS)"
  if [[ -n "$fallback_hosts" ]]; then
    local first_host="${fallback_hosts%%,*}"
    first_host="${first_host// /}"
    first_host="${first_host%%:*}"
    if [[ -n "$first_host" ]]; then
      printf '%s' "$first_host"
      return
    fi
  fi

  printf '%s' "127.0.0.1"
}

ADMIN_HOST="$(resolve_smoke_admin_host)"

read_env_port() {
  local file="$1" key="$2" default="$3"
  if [[ -f "$file" ]]; then
    local val
    val=$(grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' || true)
    if [[ -n "$val" ]]; then
      printf '%s' "$val"
      return
    fi
  fi
  printf '%s' "$default"
}

api_port=$(read_env_port "${ENV_DIR}/api.env" PORT 3001)
web_port=$(read_env_port "${ENV_DIR}/web.env" PORT 3000)
api_health_url="http://127.0.0.1:${api_port}/health"
otp_url="http://127.0.0.1:${web_port}/api/auth/request-otp"

echo "[smoke] operator phone: ${SMOKE_PHONE}"
echo "[smoke] admin Host header: ${ADMIN_HOST}:${web_port}"

assert_health_ok() {
  local body="$1"
  python3 - <<'PY' "$body"
import json, sys
raw = sys.argv[1]
data = json.loads(raw)
status = data.get("status")
if status != "ok":
    print(f"smoke: /health status={status!r}", file=sys.stderr)
    sys.exit(1)
db = (data.get("checks") or {}).get("database")
if db is not None and db.get("status") != "ok":
    print(f"smoke: database check failed: {db!r}", file=sys.stderr)
    sys.exit(1)
print("smoke: /health OK")
PY
}

assert_otp_response() {
  local http_code="$1"
  local body="$2"
  python3 - <<'PY' "$http_code" "$body"
import json, sys
code = int(sys.argv[1])
body = sys.argv[2]
data = json.loads(body) if body.strip() else {}
if code == 200 and data.get("ok") is True:
    print("smoke: OTP request OK (challenge issued)")
    raise SystemExit(0)
err = data.get("error") or {}
err_code = err.get("code") if isinstance(err, dict) else data.get("code")
if code == 503 and err_code == "DATABASE_UNAVAILABLE":
    print("smoke: OTP returned DATABASE_UNAVAILABLE — run verify-db-env / sync-db-app-role-password", file=sys.stderr)
    raise SystemExit(1)
print(f"smoke: OTP unexpected response HTTP {code} body={body!r}", file=sys.stderr)
raise SystemExit(1)
PY
}

if [[ -f "${ENV_DIR}/api.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_DIR}/api.env"
  set +a
  if [[ "${STORAGE_DRIVER:-}" == "prisma" && -n "${DATABASE_URL:-}" ]]; then
    bash "$(dirname "$0")/verify-db-env.sh" "${ENV_DIR}/api.env"
  fi
fi

health_body=""
health_body=$(curl -fsS "$api_health_url")
assert_health_ok "$health_body"

otp_body=""
otp_http=0
otp_body=$(curl -sS -X POST "$otp_url" \
  -H "Content-Type: application/json" \
  -H "Host: ${ADMIN_HOST}" \
  -d "{\"phone\":\"${SMOKE_PHONE}\"}" \
  -w $'\n%{http_code}')
otp_http="${otp_body##*$'\n'}"
otp_body="${otp_body%$'\n'*}"
assert_otp_response "$otp_http" "$otp_body"

echo "[smoke] operator login path OK"
