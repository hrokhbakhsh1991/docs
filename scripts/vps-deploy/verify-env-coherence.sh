#!/usr/bin/env bash
# Fail when api.env PORT disagrees with BFF upstream URLs (web + optional M+P with --all).
set -euo pipefail

ENV_DIR="${ENV_DIR:-/etc/app-tour}"
CHECK_ALL=0
for arg in "$@"; do
  if [[ "$arg" == "--all" ]]; then
    CHECK_ALL=1
  fi
done

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

check_env_url() {
  local file="$1"
  local key="$2"
  local url
  url="$(read_env_var "$file" "$key" || true)"
  if [[ -z "$url" ]]; then
    return 0
  fi
  local url_port
  url_port="$(parse_url_port "$url")"
  if [[ -z "$url_port" ]]; then
    echo "verify-env-coherence: ${key} in $(basename "$file") has no port: ${url}" >&2
    errors=$((errors + 1))
    return
  fi
  if [[ "$url_port" != "$api_port" ]]; then
    echo "verify-env-coherence: ${key} port ${url_port} != api.env PORT=${api_port}" >&2
    echo "  fix: set ${key}=http://127.0.0.1:${api_port} in ${file}" >&2
    errors=$((errors + 1))
  fi
}

check_env_url "$web_env" TOUR_OPS_API_URL
check_env_url "$web_env" API_INTERNAL_URL

if [[ "$CHECK_ALL" -eq 1 ]]; then
  for app_env in marketing.env portal.env; do
    file="${ENV_DIR}/${app_env}"
    if [[ ! -f "$file" ]]; then
      echo "verify-env-coherence: missing $file (required with --all)" >&2
      errors=$((errors + 1))
      continue
    fi
    check_env_url "$file" TOUR_OPS_API_URL
  done

  marketing_env="${ENV_DIR}/marketing.env"
  portal_env="${ENV_DIR}/portal.env"

  api_revalidate="$(read_env_var "$api_env" MARKETING_REVALIDATE_SECRET || true)"
  mkt_revalidate="$(read_env_var "$marketing_env" MARKETING_REVALIDATE_SECRET || true)"
  if [[ -n "$api_revalidate" || -n "$mkt_revalidate" ]]; then
    if [[ -z "$api_revalidate" || -z "$mkt_revalidate" || "$api_revalidate" != "$mkt_revalidate" ]]; then
      echo "verify-env-coherence: MARKETING_REVALIDATE_SECRET must match api.env and marketing.env" >&2
      errors=$((errors + 1))
    fi
  fi

  for file in "$web_env" "$portal_env"; do
    if ! grep -qE '^SESSION_COOKIE_SECURE=' "$file" 2>/dev/null; then
      echo "verify-env-coherence: SESSION_COOKIE_SECURE missing in $(basename "$file")" >&2
      errors=$((errors + 1))
    fi
  done

  if ! grep -qE '^PUBLIC_TENANT_FALLBACK_LABEL=' "$api_env" 2>/dev/null; then
    echo "verify-env-coherence: PUBLIC_TENANT_FALLBACK_LABEL missing in api.env (P8 env contract)" >&2
    errors=$((errors + 1))
  fi
fi

if [[ "$errors" -gt 0 ]]; then
  exit 1
fi

if [[ "$CHECK_ALL" -eq 1 ]]; then
  echo "verify-env-coherence: OK (api PORT=${api_port} · four-process)"
else
  echo "verify-env-coherence: OK (api PORT=${api_port})"
fi
