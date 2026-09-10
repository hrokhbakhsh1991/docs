#!/usr/bin/env bash
# One-shot: fix staging M↔P URLs (ingress-derived) + denali.club domains + restart.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
UNIT_PREFIX="${UNIT_PREFIX:-app-tour-staging}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/app-tour-staging}"
CURRENT="${DEPLOY_ROOT}/current"

echo "== apply-staging-member-session-url-fix (ENV_DIR=${ENV_DIR}) =="

ENV_DIR="$ENV_DIR" bash "${SCRIPT_DIR}/sync-staging-profile-b-public-urls.sh"

if [[ -f "${CURRENT}/bin/seed-wrs-denali-club-domains.cjs" ]]; then
  echo "== seed denali.club tenant_domains =="
  set -a
  # shellcheck source=/dev/null
  source "${ENV_DIR}/api.env"
  set +a
  export DATABASE_URL="${DATABASE_URL_ADMIN:-$DATABASE_URL}"
  export NODE_ENV=development
  node "${CURRENT}/bin/seed-wrs-denali-club-domains.cjs"
elif [[ -f "${DEPLOY_ROOT}/releases" ]]; then
  echo "WARN: seed-wrs-denali-club-domains.cjs not found — redeploy artifact for denali.club apex" >&2
fi

if command -v systemctl >/dev/null 2>&1; then
  systemctl restart "${UNIT_PREFIX}-marketing" "${UNIT_PREFIX}-portal"
  sleep 2
  systemctl is-active "${UNIT_PREFIX}-marketing" "${UNIT_PREFIX}-portal"
else
  echo "WARN: systemctl not found — restart marketing/portal manually" >&2
fi

echo "== verify marketing.env (ingress-derived; no hardcoded PUBLIC_BASE_URL) =="
grep -E '^(PORTAL_PUBLIC_BASE_URL|MARKETING_PUBLIC_BASE_URL|PLATFORM_ROOT_DOMAIN)=' \
  "${ENV_DIR}/marketing.env" 2>/dev/null || echo "(no hardcoded PUBLIC_BASE_URL — OK)"

echo "APPLY_STAGING_MEMBER_SESSION_URL_FIX_OK"
