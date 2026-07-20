#!/usr/bin/env bash
# MR-P0-014 — take a restore point before migrate deploy.
# Usage: ENV_DIR=/etc/app-cloud bash scripts/vps-deploy/pre-migrate-pg-dump.sh
set -euo pipefail

ENV_DIR="${ENV_DIR:-/etc/app-cloud}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/app-cloud}"
DUMP_DIR="${PRE_MIGRATE_DUMP_DIR:-/var/backups/app-cloud}"
API_ENV="${ENV_DIR}/api.env"

log() { printf '[pre-migrate-dump] %s\n' "$*"; }
die() { printf '[pre-migrate-dump] ERROR: %s\n' "$*" >&2; exit 1; }

[[ -f "$API_ENV" ]] || die "missing $API_ENV"
set -a
# shellcheck disable=SC1090
source "$API_ENV"
set +a

ADMIN_URL="${DATABASE_URL_ADMIN:-}"
[[ -n "$ADMIN_URL" ]] || die "DATABASE_URL_ADMIN required for dump"

mkdir -p "$DUMP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
SHA="$(cd "$DEPLOY_PATH" && git rev-parse --short HEAD 2>/dev/null || echo nosha)"
OUT="${DUMP_DIR}/pre-migrate-${STAMP}-${SHA}.dump"

log "dumping to $OUT"
pg_dump --format=custom --file="$OUT" "$ADMIN_URL"
log "OK $OUT"
echo "$OUT"
