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
  for key in AUTH_JWT_PUBLIC_KEY AUTH_JWT_ISSUER AUTH_JWT_AUDIENCE AUTH_JWT_PUBLIC_KEY_PREVIOUS; do
    local api_line
    api_line="$(read_api_env_line "$key")"
    if [[ -n "$api_line" ]]; then
      upsert_env_line "$target" "$api_line"
    elif [[ "$key" == "AUTH_JWT_PUBLIC_KEY_PREVIOUS" ]]; then
      # API is the verifier source of truth; never leave a surface-only key
      # that could make the same member token validate on only some surfaces.
      local tmp
      tmp="$(mktemp)"
      grep -v -E "^${key}=" "$target" >"$tmp" || true
      mv "$tmp" "$target"
    fi
  done
}

for key in AUTH_JWT_PUBLIC_KEY AUTH_JWT_ISSUER AUTH_JWT_AUDIENCE; do
  if [[ -z "$(read_api_env_line "$key")" ]]; then
    echo "sync-staging-surface-auth-env: missing required ${key} in api.env" >&2
    exit 1
  fi
done

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
