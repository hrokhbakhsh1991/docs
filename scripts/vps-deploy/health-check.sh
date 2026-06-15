#!/usr/bin/env bash
set -euo pipefail

ENV_DIR="${ENV_DIR:-/etc/app-tour}"

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

API_URL="${API_HEALTH_URL:-http://127.0.0.1:${api_port}/health}"
WEB_URL="${WEB_HEALTH_URL:-http://127.0.0.1:${web_port}/auth/login}"
MAX_ATTEMPTS="${HEALTH_CHECK_ATTEMPTS:-30}"
SLEEP_SEC="${HEALTH_CHECK_SLEEP_SEC:-2}"

log_service_status() {
  for unit in app-tour-api app-tour-web; do
    if command -v systemctl >/dev/null 2>&1; then
      echo "[health] systemctl status $unit:" >&2
      systemctl --no-pager -l status "$unit" 2>&1 | tail -12 >&2 || true
      echo "[health] journalctl -u $unit (last 20 lines):" >&2
      journalctl -u "$unit" -n 20 --no-pager 2>&1 >&2 || true
    fi
  done
}

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  api_ok=0
  web_ok=0
  api_http=0
  api_body=""

  api_http=$(curl -sS -o /tmp/app-tour-health-api.json -w "%{http_code}" "$API_URL" 2>/dev/null || echo "000")
  if [[ -f /tmp/app-tour-health-api.json ]]; then
    api_body=$(cat /tmp/app-tour-health-api.json 2>/dev/null || true)
  fi
  if [[ "$api_http" == "200" && -n "$api_body" ]]; then
    api_ok=1
  elif [[ -n "$api_body" ]]; then
    echo "[health] api HTTP $api_http: $api_body" >&2
  fi

  web_http=$(curl -sS -o /dev/null -w "%{http_code}" "$WEB_URL" 2>/dev/null || echo "000")
  if [[ "$web_http" =~ ^[23] ]]; then
    web_ok=1
  else
    echo "[health] web HTTP $web_http for $WEB_URL" >&2
  fi

  if [[ "$api_ok" -eq 1 && "$web_ok" -eq 1 ]]; then
    echo "[health] api + web OK (attempt $attempt)"
    exit 0
  fi
  sleep "$SLEEP_SEC"
done

echo "[health] FAILED — api=$API_URL web=$WEB_URL" >&2
log_service_status
exit 1
