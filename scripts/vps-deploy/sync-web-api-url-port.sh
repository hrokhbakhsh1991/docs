#!/usr/bin/env bash
# Align web.env BFF upstream URLs with api.env PORT (idempotent).
set -euo pipefail

ENV_DIR="${ENV_DIR:-/etc/app-tour}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/ports.sh
source "${SCRIPT_DIR}/lib/ports.sh"

api_env="${ENV_DIR}/api.env"
web_env="${ENV_DIR}/web.env"

[[ -f "$api_env" && -f "$web_env" ]] || exit 0

api_port="$(read_env_port "$api_env" PORT 3001)"
target_url="http://127.0.0.1:${api_port}"
changed=0

sync_env_file() {
  local env_file="$1"
  shift
  local keys=("$@")
  [[ -f "$env_file" ]] || return 0
  local file_changed=0
  for key in "${keys[@]}"; do
    local current
    current="$(read_env_var "$env_file" "$key" || true)"
    if [[ -z "$current" ]]; then
      continue
    fi
    local current_port
    current_port="$(parse_url_port "$current")"
    if [[ "$current_port" == "$api_port" ]]; then
      continue
    fi
    if grep -qE "^${key}=" "$env_file"; then
      sed -i "s|^${key}=.*|${key}=${target_url}|" "$env_file"
    else
      printf '\n%s=%s\n' "$key" "$target_url" >>"$env_file"
    fi
    echo "sync-web-api-url-port: ${env_file##*/} ${key} ${current} -> ${target_url}"
    file_changed=1
  done
  if [[ "$file_changed" -eq 1 ]]; then
    changed=1
  fi
}

sync_env_file "$web_env" TOUR_OPS_API_URL API_INTERNAL_URL
sync_env_file "${ENV_DIR}/marketing.env" TOUR_OPS_API_URL
sync_env_file "${ENV_DIR}/portal.env" TOUR_OPS_API_URL

if [[ "$changed" -eq 1 ]]; then
  echo "sync-web-api-url-port: BFF URLs aligned to api PORT ${api_port}"
fi
