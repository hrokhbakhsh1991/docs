#!/usr/bin/env bash
# One-shot: fix staging M↔P public URLs + restart marketing/portal (PCMS cookie parity).
# Usage on VPS: bash scripts/vps-deploy/apply-staging-member-session-url-fix.sh
# Remote:      VPS_HOST=89.42.210.252 bash scripts/vps-deploy/apply-staging-member-session-url-fix-remote.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
UNIT_PREFIX="${UNIT_PREFIX:-app-tour-staging}"

echo "== apply-staging-member-session-url-fix (ENV_DIR=${ENV_DIR}) =="

ENV_DIR="$ENV_DIR" bash "${SCRIPT_DIR}/sync-staging-profile-b-public-urls.sh"

if command -v systemctl >/dev/null 2>&1; then
  systemctl restart "${UNIT_PREFIX}-marketing" "${UNIT_PREFIX}-portal"
  sleep 2
  systemctl is-active "${UNIT_PREFIX}-marketing" "${UNIT_PREFIX}-portal"
else
  echo "WARN: systemctl not found — restart marketing/portal manually" >&2
fi

echo "== verify egress URLs in marketing.env =="
grep -E '^(PORTAL_PUBLIC_BASE_URL|MARKETING_PUBLIC_BASE_URL|PLATFORM_ROOT_DOMAIN)=' \
  "${ENV_DIR}/marketing.env" || true

echo "APPLY_STAGING_MEMBER_SESSION_URL_FIX_OK"
