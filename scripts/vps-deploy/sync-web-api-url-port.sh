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

update_key() {
  local key="$1"
  local current
  current="$(read_env_var "$web_env" "$key" || true)"
  if [[ -z "$current" ]]; then
    return 0
  fi
  local current_port
  current_port="$(parse_url_port "$current")"
  if [[ "$current_port" == "$api_port" ]]; then
    return 0
  fi
  if grep -qE "^${key}=" "$web_env"; then
    sed -i "s|^${key}=.*|${key}=${target_url}|" "$web_env"
  else
    printf '\n%s=%s\n' "$key" "$target_url" >>"$web_env"
  fi
  echo "sync-web-api-url-port: ${key} ${current} -> ${target_url}"
  changed=1
}

update_key TOUR_OPS_API_URL
update_key API_INTERNAL_URL

if [[ "$changed" -eq 1 ]]; then
  echo "sync-web-api-url-port: updated ${web_env}"
fi
