#!/usr/bin/env bash
# Denali Wallet v1 — staging rollback helper (pilot module disable + optional artifact revert).
#
# - Removes wallet from pilot tenant theme only (no ledger/finance deletion).
# - Optional artifact rollback via previous release symlink.
#
# VPS execute:
#   DENALI_WALLET_DEPLOY_TARGET=staging \
#   DENALI_WALLET_ROLLBACK_CONFIRM=1 \
#   ENV_DIR=/etc/app-tour-staging \
#   DEPLOY_ROOT=/opt/app-tour-staging \
#   bash scripts/vps-deploy/rollback-denali-wallet-staging.sh
#
# Artifact-only rollback (after previous-release exists):
#   DENALI_WALLET_ROLLBACK_ARTIFACT=1 \
#   ...same confirms...
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=lib/psql-url.sh
source "${SCRIPT_DIR}/lib/psql-url.sh"

ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/app-tour-staging}"
UNIT_PREFIX="${UNIT_PREFIX:-app-tour-staging}"
APP_USER="${APP_USER:-app-tour}"
DENALI_WALLET_PILOT_TENANT_ID="${DENALI_WALLET_PILOT_TENANT_ID:-00000000-0000-4000-8000-000000000430}"
ROLLBACK_ARTIFACT="${DENALI_WALLET_ROLLBACK_ARTIFACT:-0}"
DRY_RUN="${DENALI_WALLET_DEPLOY_DRY_RUN:-0}"

log() { printf '[wallet-staging-rollback] %s\n' "$*"; }
die() { printf '[wallet-staging-rollback] ERROR: %s\n' "$*" >&2; exit 1; }

export DENALI_WALLET_DEPLOY_TARGET="${DENALI_WALLET_DEPLOY_TARGET:-}"
export DENALI_WALLET_ROLLBACK_CONFIRM="${DENALI_WALLET_ROLLBACK_CONFIRM:-}"
export ENV_DIR DENALI_WALLET_PILOT_TENANT_ID

if [[ -f "${ENV_DIR}/api.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "${ENV_DIR}/api.env"
  set +a
fi
export DATABASE_URL_ADMIN="${DATABASE_URL_ADMIN:-}"

if [[ "$DRY_RUN" == "1" ]]; then
  export DENALI_WALLET_DEPLOY_DRY_RUN=1
fi

node "${SCRIPT_DIR}/lib/wallet-staging-guards-cli.mjs" validate-rollback || die "rollback guard validation failed"

if [[ "$DRY_RUN" == "1" ]]; then
  log "DRY_RUN PASS — would disable wallet module for pilot tenant ${DENALI_WALLET_PILOT_TENANT_ID}"
  if [[ "$ROLLBACK_ARTIFACT" == "1" ]]; then
    log "DRY_RUN — would switch ${DEPLOY_ROOT}/current to previous release"
  fi
  log "DRY_RUN — would restart ${UNIT_PREFIX}-{api,web,portal}"
  exit 0
fi

[[ "$(id -u)" -eq 0 ]] || die "rollback must run as root on VPS"
[[ -n "${DATABASE_URL_ADMIN:-}" ]] || die "DATABASE_URL_ADMIN required"

log "disable wallet module for pilot tenant (theme.enabledModules only)"
PILOT_TENANT_ID="$DENALI_WALLET_PILOT_TENANT_ID"
psql "$(psql_database_url "${DATABASE_URL_ADMIN}")" -v ON_ERROR_STOP=1 <<SQL
UPDATE tenants
SET theme = (
  COALESCE(theme::jsonb, '{}'::jsonb)
  - 'enabledModules'
  || jsonb_build_object('enabledModules', '[]'::jsonb)
)
WHERE id = '${PILOT_TENANT_ID}';
SQL
log "pilot wallet module disabled in tenants.theme.enabledModules"

if [[ "$ROLLBACK_ARTIFACT" == "1" ]]; then
  PREVIOUS_FILE="${DEPLOY_ROOT}/previous-release"
  [[ -f "$PREVIOUS_FILE" ]] || die "missing ${PREVIOUS_FILE} — cannot rollback artifact"
  PREVIOUS="$(cat "$PREVIOUS_FILE")"
  [[ -d "$PREVIOUS" ]] || die "previous release path invalid: ${PREVIOUS}"
  log "switch current symlink to previous release"
  ln -sfn "$PREVIOUS" "${DEPLOY_ROOT}/current"
fi

log "restart API, Web, Portal"
for unit in "${UNIT_PREFIX}-api" "${UNIT_PREFIX}-web" "${UNIT_PREFIX}-portal"; do
  systemctl restart "$unit"
done

log "WALLET_STAGING_ROLLBACK_OK (ledger + finance data untouched)"
