#!/usr/bin/env bash
# Profile B — canonical M↔P public URLs for IP:port staging (23002/23003).
# PCMS-COOK-03: egress URLs must match cookie Domain share-parent (denali.localhost),
# not raw VPS IP — otherwise marketing session is invisible on portal register.
set -euo pipefail

ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
API_ENV="${ENV_DIR}/api.env"

[[ -f "$API_ENV" ]] || {
  echo "sync-staging-profile-b-public-urls: missing $API_ENV" >&2
  exit 1
}

read_env_value() {
  local file="$1"
  local key="$2"
  grep -E "^${key}=" "$file" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' || true
}

read_api_env() {
  read_env_value "$API_ENV" "$1"
}

resolve_public_host() {
  local hosts
  hosts="$(read_api_env PUBLIC_TENANT_FALLBACK_HOSTS)"
  if [[ -n "$hosts" ]]; then
    local first="${hosts%%,*}"
    first="${first// /}"
    first="${first%%:*}"
    if [[ -n "$first" ]]; then
      printf '%s' "$first"
      return
    fi
  fi
  printf '%s' "127.0.0.1"
}

resolve_club_label() {
  local label
  label="$(read_api_env PUBLIC_TENANT_FALLBACK_LABEL)"
  label="${label// /}"
  if [[ -n "$label" ]]; then
    printf '%s' "$label"
    return
  fi
  printf '%s' "denali"
}

resolve_platform_root_domain() {
  local root
  root="$(read_api_env PLATFORM_ROOT_DOMAIN)"
  root="${root// /}"
  if [[ -n "$root" ]]; then
    printf '%s' "$root"
    return
  fi
  printf '%s' "localhost"
}

# Browser-facing M↔P URLs — hostname when localhost profile, else IP:port fallback.
resolve_marketing_public_url() {
  local club="$1"
  local root="$2"
  local port="$3"
  local public_host="$4"

  case "$root" in
    localhost | staging.localhost)
      printf 'http://%s.localhost:%s' "$club" "$port"
      ;;
    *)
      printf 'http://%s:%s' "$public_host" "$port"
      ;;
  esac
}

resolve_portal_public_url() {
  local club="$1"
  local root="$2"
  local port="$3"
  local public_host="$4"

  case "$root" in
    localhost | staging.localhost)
      printf 'http://portal.%s.localhost:%s' "$club" "$port"
      ;;
    *)
      printf 'http://%s:%s' "$public_host" "$port"
      ;;
  esac
}

set_env_kv() {
  local file="$1" key="$2" value="$3"
  [[ -f "$file" ]] || touch "$file"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >>"$file"
  fi
}

PUBLIC_HOST="$(resolve_public_host)"
CLUB_LABEL="$(resolve_club_label)"
ROOT_DOMAIN="$(resolve_platform_root_domain)"
MKT_PORT="23002"
PTL_PORT="23003"
if [[ -f "${ENV_DIR}/marketing.env" ]]; then
  mkt_from_file="$(grep -E '^PORT=' "${ENV_DIR}/marketing.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' || true)"
  [[ -n "$mkt_from_file" ]] && MKT_PORT="$mkt_from_file"
fi
if [[ -f "${ENV_DIR}/portal.env" ]]; then
  ptl_from_file="$(grep -E '^PORT=' "${ENV_DIR}/portal.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '\r' || true)"
  [[ -n "$ptl_from_file" ]] && PTL_PORT="$ptl_from_file"
fi

MARKETING_URL="$(resolve_marketing_public_url "$CLUB_LABEL" "$ROOT_DOMAIN" "$MKT_PORT" "$PUBLIC_HOST")"
PORTAL_URL="$(resolve_portal_public_url "$CLUB_LABEL" "$ROOT_DOMAIN" "$PTL_PORT" "$PUBLIC_HOST")"

for app in marketing portal web; do
  target="${ENV_DIR}/${app}.env"
  set_env_kv "$target" APP_INFRA_PROFILE staging
  set_env_kv "$target" MARKETING_DEV_PORT "$MKT_PORT"
  set_env_kv "$target" PORTAL_DEV_PORT "$PTL_PORT"
  set_env_kv "$target" SESSION_COOKIE_SECURE false
done

set_env_kv "${ENV_DIR}/web.env" ALLOW_DEV_WEB_SESSION true
set_env_kv "${ENV_DIR}/web.env" PUBLIC_TENANT_FALLBACK_LABEL "$CLUB_LABEL"
set_env_kv "${ENV_DIR}/web.env" TOUR_OPS_DEV_TENANT_ID 00000000-0000-4000-8000-000000000003
set_env_kv "${ENV_DIR}/web.env" TOUR_OPS_PUBLIC_FALLBACK_HOSTS "${PUBLIC_HOST},127.0.0.1"
set_env_kv "${ENV_DIR}/web.env" PUBLIC_TENANT_FALLBACK_HOSTS "${PUBLIC_HOST},127.0.0.1"
set_env_kv "${ENV_DIR}/api.env" PUBLIC_TENANT_FALLBACK_LABEL "$CLUB_LABEL"
set_env_kv "${ENV_DIR}/api.env" PUBLIC_TENANT_FALLBACK_HOSTS "${PUBLIC_HOST},127.0.0.1"
set_env_kv "${ENV_DIR}/api.env" MINIO_PUBLIC_ENDPOINT "http://${PUBLIC_HOST}:9002"

set_env_kv "${ENV_DIR}/marketing.env" PLATFORM_ROOT_DOMAIN localhost
set_env_kv "${ENV_DIR}/marketing.env" PORTAL_PUBLIC_BASE_URL "$PORTAL_URL"
set_env_kv "${ENV_DIR}/marketing.env" MARKETING_PUBLIC_BASE_URL "$MARKETING_URL"
set_env_kv "${ENV_DIR}/marketing.env" PUBLIC_TENANT_FALLBACK_LABEL "$CLUB_LABEL"
set_env_kv "${ENV_DIR}/marketing.env" PUBLIC_TENANT_FALLBACK_HOSTS "${PUBLIC_HOST},127.0.0.1"
set_env_kv "${ENV_DIR}/marketing.env" TOUR_OPS_PUBLIC_FALLBACK_HOSTS "${PUBLIC_HOST},127.0.0.1"
set_env_kv "${ENV_DIR}/portal.env" PLATFORM_ROOT_DOMAIN localhost
set_env_kv "${ENV_DIR}/portal.env" MARKETING_PUBLIC_BASE_URL "$MARKETING_URL"
set_env_kv "${ENV_DIR}/portal.env" PORTAL_INTERNAL_URL "http://127.0.0.1:${PTL_PORT}"
set_env_kv "${ENV_DIR}/portal.env" PUBLIC_TENANT_FALLBACK_LABEL "$CLUB_LABEL"
set_env_kv "${ENV_DIR}/portal.env" PUBLIC_TENANT_FALLBACK_HOSTS "${PUBLIC_HOST},127.0.0.1"
set_env_kv "${ENV_DIR}/portal.env" TOUR_OPS_PUBLIC_FALLBACK_HOSTS "${PUBLIC_HOST},127.0.0.1"

chown root:app-tour "${ENV_DIR}"/*.env 2>/dev/null || true
chmod 640 "${ENV_DIR}"/*.env 2>/dev/null || true

echo "sync-staging-profile-b-public-urls: OK marketing=${MARKETING_URL} portal=${PORTAL_URL} fallback_host=${PUBLIC_HOST}"
