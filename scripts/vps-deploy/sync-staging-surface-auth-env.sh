#!/usr/bin/env bash
# Propagate staging AUTH_JWT public verify keys (+ dev session flags) from api.env to surfaces.
set -euo pipefail

ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
API_ENV="${ENV_DIR}/api.env"

[[ -f "$API_ENV" ]] || {
  echo "sync-staging-surface-auth-env: missing $API_ENV" >&2
  exit 1
}

read_api_env_line() {
  local key="$1"
  grep -E "^${key}=" "$API_ENV" 2>/dev/null | tail -1 | tr -d '\r' || true
}

surface_key_is_stub() {
  local file="$1" key="$2"
  local line value
  line="$(grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | tr -d '\r' || true)"
  [[ -n "$line" ]] || return 0
  value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  if [[ "$key" == "AUTH_JWT_PUBLIC_KEY" ]]; then
    [[ ${#value} -lt 200 || "$value" == *"..."* ]]
    return
  fi
  return 1
}

upsert_env_line() {
  local file="$1" line="$2"
  local key="${line%%=*}"
  local tmp
  tmp="$(mktemp)"
  if [[ -f "$file" ]]; then
    grep -v -E "^${key}=" "$file" >"$tmp" || true
  fi
  printf '%s\n' "$line" >>"$tmp"
  mv "$tmp" "$file"
}

sync_jwt_keys_from_api() {
  local target="$1"
  [[ -f "$target" ]] || return 0
  for key in AUTH_JWT_PUBLIC_KEY AUTH_JWT_ISSUER AUTH_JWT_AUDIENCE; do
    local api_line
    api_line="$(read_api_env_line "$key")"
    [[ -n "$api_line" ]] || continue
    if surface_key_is_stub "$target" "$key" || ! grep -q "^${key}=" "$target" 2>/dev/null; then
      upsert_env_line "$target" "$api_line"
    fi
  done
}

ensure_line() {
  local key="$1" value="$2" target="$3"
  if grep -q "^${key}=" "$target" 2>/dev/null; then
    return 0
  fi
  printf '%s=%s\n' "$key" "$value" >>"$target"
}

for app in web portal marketing; do
  sync_jwt_keys_from_api "${ENV_DIR}/${app}.env"
done

web_env="${ENV_DIR}/web.env"
if [[ -f "$web_env" ]]; then
  ensure_line ALLOW_DEV_WEB_SESSION true "$web_env"
  ensure_line ALLOW_DENALI_WEB_PLUGIN true "$web_env"
fi

for app in portal marketing; do
  target="${ENV_DIR}/${app}.env"
  [[ -f "$target" ]] || continue
  ensure_line ALLOW_DEV_WEB_SESSION true "$target"
done

chown root:app-tour "${ENV_DIR}"/*.env 2>/dev/null || true
chmod 640 "${ENV_DIR}"/*.env 2>/dev/null || true

echo "sync-staging-surface-auth-env: OK"
