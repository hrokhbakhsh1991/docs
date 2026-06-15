#!/usr/bin/env bash
# Fail when api.env PORT disagrees with web BFF upstream URLs.
set -euo pipefail

ENV_DIR="${ENV_DIR:-/etc/app-tour}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/ports.sh
source "${SCRIPT_DIR}/lib/ports.sh"

api_env="${ENV_DIR}/api.env"
web_env="${ENV_DIR}/web.env"

[[ -f "$api_env" ]] || {
  echo "verify-env-coherence: missing $api_env" >&2
  exit 1
}
[[ -f "$web_env" ]] || {
  echo "verify-env-coherence: missing $web_env" >&2
  exit 1
}

api_port="$(read_env_port "$api_env" PORT 3001)"
errors=0

check_web_url() {
  local key="$1"
  local url
  url="$(read_env_var "$web_env" "$key" || true)"
  if [[ -z "$url" ]]; then
    return 0
  fi
  local url_port
  url_port="$(parse_url_port "$url")"
  if [[ -z "$url_port" ]]; then
    echo "verify-env-coherence: ${key} in web.env has no port: ${url}" >&2
    errors=$((errors + 1))
    return
  fi
  if [[ "$url_port" != "$api_port" ]]; then
    echo "verify-env-coherence: ${key} port ${url_port} != api.env PORT=${api_port}" >&2
    echo "  fix: set ${key}=http://127.0.0.1:${api_port} in ${web_env}" >&2
    errors=$((errors + 1))
  fi
}

check_web_url TOUR_OPS_API_URL
check_web_url API_INTERNAL_URL

if [[ "$errors" -gt 0 ]]; then
  exit 1
fi

echo "verify-env-coherence: OK (api PORT=${api_port})"
