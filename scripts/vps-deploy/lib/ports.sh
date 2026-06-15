#!/usr/bin/env bash
# Shared helpers for reading VPS env ports and probing listeners.

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

read_env_var() {
  local file="$1" key="$2"
  if [[ ! -f "$file" ]]; then
    return 1
  fi
  local val
  val=$(grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' || true)
  if [[ -z "$val" ]]; then
    return 1
  fi
  printf '%s' "$val"
}

parse_url_port() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import urlparse
raw = sys.argv[1]
u = urlparse(raw)
print(u.port or "")
PY
}

collect_app_ports() {
  local env_dir="${1:-/etc/app-tour}"
  API_PORT="$(read_env_port "${env_dir}/api.env" PORT 3001)"
  WEB_PORT="$(read_env_port "${env_dir}/web.env" PORT 3000)"
  APP_PORTS=("$API_PORT" "$WEB_PORT")
  for legacy in 3000 3001; do
    local seen=0 p
    for p in "${APP_PORTS[@]}"; do
      if [[ "$p" == "$legacy" ]]; then
        seen=1
        break
      fi
    done
    if [[ "$seen" -eq 0 ]]; then
      APP_PORTS+=("$legacy")
    fi
  done
}

pids_listening_on_port() {
  local port="$1"
  if ! command -v ss >/dev/null 2>&1; then
    return 0
  fi
  ss -tlnp "sport = :${port}" 2>/dev/null \
    | awk -v port=":${port}" '
        $1 == "LISTEN" && $4 ~ port {
          while (match($0, /pid=[0-9]+/)) {
            print substr($0, RSTART + 4, RLENGTH - 4)
            $0 = substr($0, RSTART + RLENGTH)
          }
        }' \
    | sort -u
}

port_is_listening() {
  local port="$1"
  ss -tln 2>/dev/null | awk -v port=":${port}" '$4 ~ port { found=1 } END { exit(found ? 0 : 1) }'
}

wait_for_port_listen() {
  local port="$1" max_attempts="${2:-30}" sleep_sec="${3:-1}"
  local attempt
  for attempt in $(seq 1 "$max_attempts"); do
    if port_is_listening "$port"; then
      return 0
    fi
    sleep "$sleep_sec"
  done
  return 1
}
