#!/usr/bin/env bash
# Profile B — staging env parity (fallback hosts + public M↔P URLs).
# Public staging is served through Caddy/Arvan HTTPS. Keep the public URL
# contract in this deploy-time synchronizer so artifact installs cannot restore
# localhost development URLs.
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

resolve_root_domain() {
  local domain
  domain="$(read_api_env PLATFORM_ROOT_DOMAIN)"
  if [[ -n "$domain" && "$domain" != "localhost" ]]; then
    printf '%s' "$domain"
    return
  fi
  printf '%s' "${STAGING_PUBLIC_ROOT_DOMAIN:-shenski.com}"
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
PUBLIC_ROOT_DOMAIN="$(resolve_root_domain)"
PUBLIC_MARKETING_BASE_URL="${STAGING_PUBLIC_MARKETING_BASE_URL:-https://${CLUB_LABEL}.${PUBLIC_ROOT_DOMAIN}}"
PUBLIC_PORTAL_BASE_URL="${STAGING_PUBLIC_PORTAL_BASE_URL:-https://portal.${CLUB_LABEL}.${PUBLIC_ROOT_DOMAIN}}"
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

for app in marketing portal web; do
  target="${ENV_DIR}/${app}.env"
  set_env_kv "$target" APP_INFRA_PROFILE staging
  set_env_kv "$target" MARKETING_DEV_PORT "$MKT_PORT"
  set_env_kv "$target" PORTAL_DEV_PORT "$PTL_PORT"
  set_env_kv "$target" PLATFORM_ROOT_DOMAIN "$PUBLIC_ROOT_DOMAIN"
  set_env_kv "$target" SESSION_COOKIE_SECURE true
done
set_env_kv "${ENV_DIR}/api.env" PLATFORM_ROOT_DOMAIN "$PUBLIC_ROOT_DOMAIN"

set_env_kv "${ENV_DIR}/web.env" ALLOW_DEV_WEB_SESSION true
set_env_kv "${ENV_DIR}/web.env" PUBLIC_TENANT_FALLBACK_LABEL "$CLUB_LABEL"
set_env_kv "${ENV_DIR}/web.env" TOUR_OPS_DEV_TENANT_ID 00000000-0000-4000-8000-000000000003
set_env_kv "${ENV_DIR}/web.env" TOUR_OPS_PUBLIC_FALLBACK_HOSTS "${PUBLIC_HOST},127.0.0.1"
set_env_kv "${ENV_DIR}/web.env" PUBLIC_TENANT_FALLBACK_HOSTS "${PUBLIC_HOST},127.0.0.1"
set_env_kv "${ENV_DIR}/api.env" PUBLIC_TENANT_FALLBACK_LABEL "$CLUB_LABEL"
set_env_kv "${ENV_DIR}/api.env" PUBLIC_TENANT_FALLBACK_HOSTS "${PUBLIC_HOST},127.0.0.1"
set_env_kv "${ENV_DIR}/api.env" MINIO_PUBLIC_ENDPOINT "http://${PUBLIC_HOST}:9002"

# Public egress origins. These are overridable for a staging tenant and are
# deliberately HTTPS so cross-surface auth never points at an internal port.
set_env_kv "${ENV_DIR}/marketing.env" MARKETING_PUBLIC_BASE_URL "$PUBLIC_MARKETING_BASE_URL"
set_env_kv "${ENV_DIR}/marketing.env" MARKETING_PUBLIC_BASE_URL_ALLOWLIST "$PUBLIC_MARKETING_BASE_URL"
set_env_kv "${ENV_DIR}/marketing.env" PORTAL_PUBLIC_BASE_URL "$PUBLIC_PORTAL_BASE_URL"
set_env_kv "${ENV_DIR}/web.env" MARKETING_PUBLIC_BASE_URL "$PUBLIC_MARKETING_BASE_URL"
set_env_kv "${ENV_DIR}/web.env" MARKETING_PUBLIC_BASE_URL_ALLOWLIST "$PUBLIC_MARKETING_BASE_URL"
set_env_kv "${ENV_DIR}/portal.env" MARKETING_PUBLIC_BASE_URL "$PUBLIC_MARKETING_BASE_URL"
set_env_kv "${ENV_DIR}/portal.env" MARKETING_PUBLIC_BASE_URL_ALLOWLIST "$PUBLIC_MARKETING_BASE_URL"

set_env_kv "${ENV_DIR}/marketing.env" PUBLIC_TENANT_FALLBACK_LABEL "$CLUB_LABEL"
set_env_kv "${ENV_DIR}/marketing.env" PUBLIC_TENANT_FALLBACK_HOSTS "${PUBLIC_HOST},127.0.0.1"
set_env_kv "${ENV_DIR}/marketing.env" TOUR_OPS_PUBLIC_FALLBACK_HOSTS "${PUBLIC_HOST},127.0.0.1"
set_env_kv "${ENV_DIR}/portal.env" PORTAL_INTERNAL_URL "http://127.0.0.1:${PTL_PORT}"
set_env_kv "${ENV_DIR}/portal.env" PUBLIC_TENANT_FALLBACK_LABEL "$CLUB_LABEL"
set_env_kv "${ENV_DIR}/portal.env" PUBLIC_TENANT_FALLBACK_HOSTS "${PUBLIC_HOST},127.0.0.1"
set_env_kv "${ENV_DIR}/portal.env" TOUR_OPS_PUBLIC_FALLBACK_HOSTS "${PUBLIC_HOST},127.0.0.1"

chown root:app-tour "${ENV_DIR}"/*.env 2>/dev/null || true
chmod 640 "${ENV_DIR}"/*.env 2>/dev/null || true

echo "sync-staging-profile-b-public-urls: OK profile=staging public-root=${PUBLIC_ROOT_DOMAIN} fallback_host=${PUBLIC_HOST} ports=${MKT_PORT}/${PTL_PORT}"
