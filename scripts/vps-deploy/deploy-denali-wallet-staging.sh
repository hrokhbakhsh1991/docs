#!/usr/bin/env bash
# Denali Wallet v1 — staging deploy orchestrator (VPS-side, API + Web + Portal only).
#
# Does NOT transfer artifacts or SSH. Run after install-staging-artifact.sh on staging VPS.
#
# Local dry-run (no VPS / DB side effects):
#   DENALI_WALLET_DEPLOY_TARGET=staging \
#   DENALI_WALLET_STAGING_CONFIRM=1 \
#   DENALI_WALLET_DEPLOY_DRY_RUN=1 \
#   ENV_DIR=/etc/app-tour-staging \
#   DEPLOY_ROOT=/opt/app-tour-staging \
#   STORAGE_DRIVER=prisma \
#   DATABASE_URL=postgres://present \
#   DATABASE_URL_ADMIN=postgres://present \
#   bash scripts/vps-deploy/deploy-denali-wallet-staging.sh
#
# VPS execute (after artifact install):
#   DENALI_WALLET_DEPLOY_TARGET=staging \
#   DENALI_WALLET_STAGING_CONFIRM=1 \
#   DENALI_WALLET_EXECUTION_CONTEXT=vps \
#   ENV_DIR=/etc/app-tour-staging \
#   DEPLOY_ROOT=/opt/app-tour-staging \
#   EXPECTED_RELEASE_SHA=b7cb0c17 \
#   DENALI_WALLET_SEED_PILOT=1 \
#   bash /opt/app-tour-staging/tooling/scripts/vps-deploy/deploy-denali-wallet-staging.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/app-tour-staging}"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
UNIT_PREFIX="${UNIT_PREFIX:-app-tour-staging}"
APP_USER="${APP_USER:-app-tour}"
EXPECTED_RELEASE_SHA="${EXPECTED_RELEASE_SHA:-}"
DENALI_WALLET_SEED_PILOT="${DENALI_WALLET_SEED_PILOT:-0}"
DRY_RUN="${DENALI_WALLET_DEPLOY_DRY_RUN:-0}"

log() { printf '[wallet-staging-deploy] %s\n' "$*"; }
die() { printf '[wallet-staging-deploy] ERROR: %s\n' "$*" >&2; exit 1; }

export DENALI_WALLET_DEPLOY_TARGET="${DENALI_WALLET_DEPLOY_TARGET:-}"
export DENALI_WALLET_STAGING_CONFIRM="${DENALI_WALLET_STAGING_CONFIRM:-}"
export ENV_DIR DEPLOY_ROOT EXPECTED_RELEASE_SHA DENALI_WALLET_SEED_PILOT

if [[ "$(id -u)" -eq 0 ]]; then
  export DENALI_WALLET_IS_ROOT=1
else
  export DENALI_WALLET_IS_ROOT=0
fi

if [[ -f "${ENV_DIR}/api.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "${ENV_DIR}/api.env"
  set +a
fi

export STORAGE_DRIVER="${STORAGE_DRIVER:-}"
export DATABASE_URL="${DATABASE_URL:-}"
export DATABASE_URL_ADMIN="${DATABASE_URL_ADMIN:-}"
export NODE_ENV="${NODE_ENV:-}"

if [[ "$DRY_RUN" == "1" ]]; then
  export DENALI_WALLET_DEPLOY_DRY_RUN=1
fi

node "${SCRIPT_DIR}/lib/wallet-staging-guards-cli.mjs" validate-deploy || die "staging guard validation failed"

RELEASE_ROOT="${DEPLOY_ROOT}/current"
[[ -L "$RELEASE_ROOT" || -d "$RELEASE_ROOT" ]] || {
  if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY_RUN: release root ${RELEASE_ROOT} not present — skipping install steps"
    RELEASE_ROOT="${DEPLOY_ROOT}/releases/dry-run-placeholder"
  else
    die "release root missing at ${RELEASE_ROOT} — run install-staging-artifact.sh first"
  fi
}

if [[ -n "$EXPECTED_RELEASE_SHA" && -f "${RELEASE_ROOT}/release-manifest.json" ]]; then
  INSTALLED_SHA="$(python3 -c "import json; print(json.load(open('${RELEASE_ROOT}/release-manifest.json'))['releaseSha'])" 2>/dev/null || true)"
  if [[ -n "$INSTALLED_SHA" && -n "$EXPECTED_RELEASE_SHA" ]]; then
    if [[ "$INSTALLED_SHA" != "$EXPECTED_RELEASE_SHA" && "$INSTALLED_SHA" != "${EXPECTED_RELEASE_SHA}"* && "$EXPECTED_RELEASE_SHA" != "${INSTALLED_SHA}"* ]]; then
      die "installed release ${INSTALLED_SHA} does not match EXPECTED_RELEASE_SHA=${EXPECTED_RELEASE_SHA}"
    fi
  fi
  log "release manifest sha=${INSTALLED_SHA:-unknown}"
fi

if [[ "$DRY_RUN" == "1" ]]; then
  log "DRY_RUN PASS — guards OK; would migrate, optionally seed pilot, restart api/web/portal"
  log "migrate: ${RELEASE_ROOT}/bin/migrate-deploy.sh ${ENV_DIR}/api.env"
  if [[ "$DENALI_WALLET_SEED_PILOT" == "1" ]]; then
    log "seed: ${RELEASE_ROOT}/bin/seed-denali-wallet-pilot.sh ${ENV_DIR}/api.env"
  else
    log "seed: skipped (set DENALI_WALLET_SEED_PILOT=1 to run pilot seed)"
  fi
  log "restart: systemctl restart ${UNIT_PREFIX}-{api,web,portal}"
  log "verify: bash ${SCRIPT_DIR}/verify-denali-wallet-staging.sh"
  exit 0
fi

[[ "$(id -u)" -eq 0 ]] || die "VPS deploy must run as root (omit DENALI_WALLET_DEPLOY_DRY_RUN=1)"
export DENALI_WALLET_EXECUTION_CONTEXT=vps
node "${SCRIPT_DIR}/lib/wallet-staging-guards-cli.mjs" validate-deploy || die "VPS guard validation failed"

log "migrate deploy (wallet tables + RLS)"
export DATABASE_URL="${DATABASE_URL_ADMIN:-$DATABASE_URL}"
sudo -u "$APP_USER" env HOME="$DEPLOY_ROOT" \
  bash "${RELEASE_ROOT}/bin/migrate-deploy.sh" "${ENV_DIR}/api.env"

if [[ "$DENALI_WALLET_SEED_PILOT" == "1" ]]; then
  log "seed Denali Wallet pilot tenant (explicit opt-in)"
  [[ -f "${RELEASE_ROOT}/bin/seed-denali-wallet-pilot.sh" ]] || \
    die "missing ${RELEASE_ROOT}/bin/seed-denali-wallet-pilot.sh — rebuild artifact with wallet seed bundle"
  sudo -u "$APP_USER" env HOME="$DEPLOY_ROOT" NODE_ENV=development \
    bash "${RELEASE_ROOT}/bin/seed-denali-wallet-pilot.sh" "${ENV_DIR}/api.env"
else
  log "pilot seed skipped — set DENALI_WALLET_SEED_PILOT=1 to enable"
fi

log "restart API, Web, Portal (Wallet surfaces only)"
for unit in "${UNIT_PREFIX}-api" "${UNIT_PREFIX}-web" "${UNIT_PREFIX}-portal"; do
  systemctl restart "$unit"
done

log "post-deploy verification"
ENV_DIR="$ENV_DIR" DEPLOY_ROOT="$DEPLOY_ROOT" UNIT_PREFIX="$UNIT_PREFIX" \
  bash "${SCRIPT_DIR}/verify-denali-wallet-staging.sh"

log "WALLET_STAGING_DEPLOY_OK"
