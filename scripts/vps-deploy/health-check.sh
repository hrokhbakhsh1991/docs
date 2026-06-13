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

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  api_ok=0
  web_ok=0
  curl -fsS "$API_URL" >/dev/null 2>&1 && api_ok=1
  curl -fsS -o /dev/null "$WEB_URL" 2>/dev/null && web_ok=1
  if [[ "$api_ok" -eq 1 && "$web_ok" -eq 1 ]]; then
    echo "[health] api + web OK (attempt $attempt)"
    exit 0
  fi
  sleep "$SLEEP_SEC"
done

echo "[health] FAILED — api=$API_URL web=$WEB_URL" >&2
exit 1
