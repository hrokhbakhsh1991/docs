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

set_json_env_kv() {
  local file="$1" key="$2" value="$3"
  [[ "$value" != *$'\n'* && "$value" != *$'\r'* ]] || {
    echo "sync-staging-profile-b-public-urls: $key must be a single-line JSON value" >&2
    exit 1
  }
  [[ "$value" != *"'"* ]] || {
    echo "sync-staging-profile-b-public-urls: $key cannot contain a single quote in a shell env file" >&2
    exit 1
  }
  [[ -f "$file" ]] || touch "$file"
  sed -i "/^${key}=/d" "$file"
  # These env files are sourced by the systemd start scripts. Single quotes
  # preserve the JSON's double quotes while keeping the assignment shell-safe.
  printf "%s='%s'\n" "$key" "$value" >>"$file"
}

PUBLIC_HOST="$(resolve_public_host)"
CLUB_LABEL="$(resolve_club_label)"
PUBLIC_ROOT_DOMAIN="$(resolve_root_domain)"
MINIO_PUBLIC_HOST="${STAGING_PUBLIC_MINIO_HOST:-storage.${CLUB_LABEL}.${PUBLIC_ROOT_DOMAIN}}"
PUBLIC_MARKETING_BASE_URL="${STAGING_PUBLIC_MARKETING_BASE_URL:-https://staging-${CLUB_LABEL}.${PUBLIC_ROOT_DOMAIN}}"
PUBLIC_PORTAL_BASE_URL="${STAGING_PUBLIC_PORTAL_BASE_URL:-https://staging-portal-${CLUB_LABEL}.${PUBLIC_ROOT_DOMAIN}}"
STAGING_ADMIN_HOST="${STAGING_ADMIN_HOST:-staging-admin-${CLUB_LABEL}.${PUBLIC_ROOT_DOMAIN}}"
# The explicit map keeps cross-surface egress and session cookies tenant-bound.
# Supply it from the approved staging inventory; never infer tenant B's hosts.
API_TENANT_SURFACE_ORIGIN_MAP_JSON="$(read_api_env TENANT_SURFACE_ORIGIN_MAP_JSON)"
if [[ "${API_TENANT_SURFACE_ORIGIN_MAP_JSON:0:1}" == "'" && "${API_TENANT_SURFACE_ORIGIN_MAP_JSON: -1}" == "'" ]]; then
  API_TENANT_SURFACE_ORIGIN_MAP_JSON="${API_TENANT_SURFACE_ORIGIN_MAP_JSON:1:${#API_TENANT_SURFACE_ORIGIN_MAP_JSON}-2}"
fi
TENANT_SURFACE_ORIGIN_MAP_JSON="${STAGING_TENANT_SURFACE_ORIGIN_MAP_JSON:-$API_TENANT_SURFACE_ORIGIN_MAP_JSON}"
[[ -n "$TENANT_SURFACE_ORIGIN_MAP_JSON" ]] || {
  echo "sync-staging-profile-b-public-urls: TENANT_SURFACE_ORIGIN_MAP_JSON is required in ${API_ENV} or STAGING_TENANT_SURFACE_ORIGIN_MAP_JSON" >&2
  exit 1
}
TENANT_SURFACE_ORIGIN_MAP_JSON="$(node -e '
  const value = JSON.parse(process.argv[1]);
  const aliases = {
    admin: process.argv[2],
    marketing: process.argv[3],
    portal: process.argv[4],
  };
  if (value?.version !== 1 || !Array.isArray(value.tenants) || value.tenants.length < 2) process.exit(2);
  const ids = new Set(), hosts = new Set(), domains = [];
  for (const tenant of value.tenants) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(tenant.tenantId ?? "")) process.exit(3);
    const id = tenant.tenantId.toLowerCase();
    if (ids.has(id)) process.exit(3);
    ids.add(id);
    if (!tenant.origins || !["admin", "marketing", "portal"].every((key) => typeof tenant.origins[key] === "string")) process.exit(4);
    if (tenant.cookieDomain !== null && typeof tenant.cookieDomain !== "string") process.exit(5);
    const tenantDomains = tenant.cookieDomain ? [tenant.cookieDomain] : [];
    for (const origin of Object.values(tenant.origins)) {
      const url = new URL(origin);
      if (url.protocol !== "https:" || url.hostname.endsWith(".") || url.port || url.username || url.password || url.pathname !== "/" || url.search || url.hash || hosts.has(url.hostname)) process.exit(6);
      hosts.add(url.hostname);
      if (tenant.cookieDomain && url.hostname !== tenant.cookieDomain && !url.hostname.endsWith(`.${tenant.cookieDomain}`)) process.exit(7);
    }
    if (tenant.aliases !== undefined && (!tenant.aliases || typeof tenant.aliases !== "object" || Array.isArray(tenant.aliases) || Object.keys(tenant.aliases).some((key) => !["admin", "marketing", "portal"].includes(key)))) process.exit(11);
    tenant.aliases ??= {};
    for (const [surface, surfaceAliases] of Object.entries(tenant.aliases)) {
      if (!["admin", "marketing", "portal"].includes(surface) || !Array.isArray(surfaceAliases)) process.exit(12);
      for (const alias of surfaceAliases) {
        if (!alias || typeof alias !== "object" || typeof alias.origin !== "string" || (alias.cookieDomain !== null && typeof alias.cookieDomain !== "string")) process.exit(13);
        const url = new URL(alias.origin);
        if (url.protocol !== "https:" || url.hostname.endsWith(".") || url.port || url.username || url.password || url.pathname !== "/" || url.search || url.hash || hosts.has(url.hostname)) process.exit(14);
        hosts.add(url.hostname);
        if (alias.cookieDomain && (url.hostname !== alias.cookieDomain && !url.hostname.endsWith(`.${alias.cookieDomain}`))) process.exit(15);
        if (alias.cookieDomain) tenantDomains.push(alias.cookieDomain);
      }
    }
    domains.push(tenantDomains);
  }
  const tenantA = value.tenants.find((tenant) => tenant.origins.marketing === "https://denali.staging.test");
  if (!tenantA) process.exit(9);
  const tenantADomains = domains[value.tenants.indexOf(tenantA)];
  if (!tenantADomains) process.exit(17);
  for (const [surface, origin] of Object.entries(aliases)) {
    const url = new URL(origin);
    const aliasCookieDomain = process.argv[5];
    const existing = tenantA.aliases[surface] ?? [];
    const existingAlias = existing.find((alias) => alias.origin === url.origin);
    if (url.protocol !== "https:" || url.port || url.username || url.password || url.pathname !== "/" || url.search || url.hash || (url.hostname !== aliasCookieDomain && !url.hostname.endsWith(`.${aliasCookieDomain}`)) || (existingAlias === undefined && hosts.has(url.hostname))) process.exit(10);
    if (existingAlias !== undefined && existingAlias.cookieDomain !== aliasCookieDomain) process.exit(16);
    if (existingAlias === undefined) {
      hosts.add(url.hostname);
      existing.push({ origin: url.origin, cookieDomain: process.argv[5] });
    }
    if (!tenantADomains.includes(aliasCookieDomain)) tenantADomains.push(aliasCookieDomain);
    tenantA.aliases[surface] = existing;
  }
  for (let i = 0; i < domains.length; i++) for (let j = i + 1; j < domains.length; j++) for (const a of domains[i]) for (const b of domains[j]) if (a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`)) process.exit(8);
  process.stdout.write(JSON.stringify(value));
' "$TENANT_SURFACE_ORIGIN_MAP_JSON" "https://${STAGING_ADMIN_HOST}" "$PUBLIC_MARKETING_BASE_URL" "$PUBLIC_PORTAL_BASE_URL" "$PUBLIC_ROOT_DOMAIN")" || {
  echo "sync-staging-profile-b-public-urls: invalid tenant surface origin map" >&2
  exit 1
}
if [[ "${1:-}" == "--validate-only" ]]; then
  echo "sync-staging-profile-b-public-urls: tenant surface origin map valid"
  exit 0
fi
if [[ $# -gt 0 ]]; then
  echo "sync-staging-profile-b-public-urls: unexpected argument: $1" >&2
  exit 2
fi
# Profile B uses sibling hosts instead of portal.{tenant}.{root}. The common
# parent is explicit so the member session is readable by both staging
# marketing and staging portal. The staging-only cookie name prevents it from
# being consumed as the production member session.
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
# The API resolves only exact .staging.test hosts from the operator-managed
# tenant surface map. The profile marker keeps this private binding out of prod.
set_env_kv "${ENV_DIR}/api.env" APP_INFRA_PROFILE staging
# Staging hosts live under the production DNS root but are registered as
# custom tenant domains. Prevent the API from parsing staging-denali as a
# platform tenant label before it checks tenant_domains.
set_env_kv "${ENV_DIR}/api.env" TENANT_ROOT_DOMAIN "staging.invalid"

set_env_kv "${ENV_DIR}/web.env" ALLOW_DEV_WEB_SESSION true
set_env_kv "${ENV_DIR}/web.env" PUBLIC_TENANT_FALLBACK_LABEL "$CLUB_LABEL"
set_env_kv "${ENV_DIR}/web.env" OPERATOR_ADMIN_ROOT_HOSTS "$STAGING_ADMIN_HOST"
set_env_kv "${ENV_DIR}/web.env" TOUR_OPS_DEV_TENANT_ID 00000000-0000-4000-8000-000000000003
set_env_kv "${ENV_DIR}/web.env" TOUR_OPS_PUBLIC_FALLBACK_HOSTS "${PUBLIC_HOST},127.0.0.1"
set_env_kv "${ENV_DIR}/web.env" PUBLIC_TENANT_FALLBACK_HOSTS "${PUBLIC_HOST},127.0.0.1"
set_env_kv "${ENV_DIR}/api.env" PUBLIC_TENANT_FALLBACK_LABEL "$CLUB_LABEL"
set_env_kv "${ENV_DIR}/api.env" PUBLIC_TENANT_FALLBACK_HOSTS "${PUBLIC_HOST},127.0.0.1"
set_env_kv "${ENV_DIR}/api.env" MINIO_PUBLIC_HOST "$MINIO_PUBLIC_HOST"
set_env_kv "${ENV_DIR}/api.env" MINIO_PUBLIC_ENDPOINT "https://${MINIO_PUBLIC_HOST}"

# Public egress origins. These are overridable for a staging tenant and are
# deliberately HTTPS so cross-surface auth never points at an internal port.
set_env_kv "${ENV_DIR}/marketing.env" MARKETING_PUBLIC_BASE_URL "$PUBLIC_MARKETING_BASE_URL"
set_env_kv "${ENV_DIR}/marketing.env" MARKETING_PUBLIC_BASE_URL_ALLOWLIST "$PUBLIC_MARKETING_BASE_URL"
set_env_kv "${ENV_DIR}/marketing.env" PORTAL_PUBLIC_BASE_URL "$PUBLIC_PORTAL_BASE_URL"
sed -i '/^MEMBER_SESSION_COOKIE_HOST_ONLY=/d' "${ENV_DIR}/marketing.env"
set_env_kv "${ENV_DIR}/marketing.env" MEMBER_SESSION_COOKIE_NAME atour_mb_session_staging
set_env_kv "${ENV_DIR}/marketing.env" MEMBER_SESSION_COOKIE_DOMAIN shenski.com
set_env_kv "${ENV_DIR}/web.env" MARKETING_PUBLIC_BASE_URL "$PUBLIC_MARKETING_BASE_URL"
set_env_kv "${ENV_DIR}/web.env" MARKETING_PUBLIC_BASE_URL_ALLOWLIST "$PUBLIC_MARKETING_BASE_URL"
set_env_kv "${ENV_DIR}/portal.env" MARKETING_PUBLIC_BASE_URL "$PUBLIC_MARKETING_BASE_URL"
set_env_kv "${ENV_DIR}/portal.env" MARKETING_PUBLIC_BASE_URL_ALLOWLIST "$PUBLIC_MARKETING_BASE_URL"
set_env_kv "${ENV_DIR}/portal.env" PORTAL_PUBLIC_BASE_URL "$PUBLIC_PORTAL_BASE_URL"
sed -i '/^MEMBER_SESSION_COOKIE_HOST_ONLY=/d' "${ENV_DIR}/portal.env"
set_env_kv "${ENV_DIR}/portal.env" MEMBER_SESSION_COOKIE_NAME atour_mb_session_staging
set_env_kv "${ENV_DIR}/portal.env" MEMBER_SESSION_COOKIE_DOMAIN shenski.com

# Explicit tenant map takes precedence over legacy single-origin and shared-cookie
# settings. Removing the global cookie domain makes null map entries host-only.
for app in marketing portal web; do
  target="${ENV_DIR}/${app}.env"
  sed -i '/^MEMBER_SESSION_COOKIE_DOMAIN=/d' "$target"
  set_json_env_kv "$target" TENANT_SURFACE_ORIGIN_MAP_JSON "$TENANT_SURFACE_ORIGIN_MAP_JSON"
done
set_json_env_kv "$API_ENV" TENANT_SURFACE_ORIGIN_MAP_JSON "$TENANT_SURFACE_ORIGIN_MAP_JSON"
MAP_SHA256="$(printf '%s' "$TENANT_SURFACE_ORIGIN_MAP_JSON" | sha256sum | awk '{print $1}')"
echo "sync-staging-profile-b-public-urls: private staging host map enabled for exact .staging.test entries map_sha256=${MAP_SHA256}"

set_env_kv "${ENV_DIR}/marketing.env" PUBLIC_TENANT_FALLBACK_LABEL "$CLUB_LABEL"
set_env_kv "${ENV_DIR}/marketing.env" PUBLIC_TENANT_FALLBACK_HOSTS "${PUBLIC_HOST},127.0.0.1"
set_env_kv "${ENV_DIR}/marketing.env" TOUR_OPS_PUBLIC_FALLBACK_HOSTS "${PUBLIC_HOST},127.0.0.1"
set_env_kv "${ENV_DIR}/portal.env" PORTAL_INTERNAL_URL "http://127.0.0.1:${PTL_PORT}"
set_env_kv "${ENV_DIR}/portal.env" PUBLIC_TENANT_FALLBACK_LABEL "$CLUB_LABEL"
set_env_kv "${ENV_DIR}/portal.env" PUBLIC_TENANT_FALLBACK_HOSTS "${PUBLIC_HOST},127.0.0.1"
set_env_kv "${ENV_DIR}/portal.env" TOUR_OPS_PUBLIC_FALLBACK_HOSTS "${PUBLIC_HOST},127.0.0.1"

chown root:app-tour "${ENV_DIR}"/*.env 2>/dev/null || true
chmod 640 "${ENV_DIR}"/*.env 2>/dev/null || true

echo "sync-staging-profile-b-public-urls: OK profile=staging public-root=${PUBLIC_ROOT_DOMAIN} fallback_host=${PUBLIC_HOST} minio_host=${MINIO_PUBLIC_HOST} ports=${MKT_PORT}/${PTL_PORT}"
