#!/usr/bin/env bash
set -euo pipefail

ENV_DIR="${ENV_DIR:-/etc/app-tour}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/ports.sh
source "${SCRIPT_DIR}/lib/ports.sh"

collect_app_ports "$ENV_DIR"
api_port="$API_PORT"
web_port="$WEB_PORT"

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
  if command -v ss >/dev/null 2>&1; then
    echo "[health] listening TCP ports (app + legacy):" >&2
    for port in "${APP_PORTS[@]}"; do
      if port_is_listening "$port"; then
        echo "[health]   :${port} LISTEN" >&2
      else
        echo "[health]   :${port} (not listening)" >&2
      fi
    done
  fi
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
if [[ "$api_port" != "3001" ]] && port_is_listening 3001 && ! port_is_listening "$api_port"; then
  echo "[health] hint: API is listening on :3001 but api.env PORT=${api_port} — run stop-stale-listeners.sh and restart" >&2
fi
log_service_status
exit 1
