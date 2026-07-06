#!/usr/bin/env bash
# Ensure local Postgres is ready for finance-ops.spec.ts (P6/P7 staging gates).
# Prints export lines to stdout; logs go to stderr. Usage:
#   eval "$(bash scripts/ensure-p6-finance-postgres.sh)"
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PHASE4_DB_PORT:-5434}"
HOST="${PGHOST:-127.0.0.1}"

log() { printf '[ensure-p6-finance-postgres] %s\n' "$*" >&2; }
die() { printf '[ensure-p6-finance-postgres] ERROR: %s\n' "$*" >&2; exit 1; }

psql_ok() {
  psql "$1" -v ON_ERROR_STOP=1 -tc "SELECT 1" >/dev/null 2>&1
}

pick_bootstrap_url() {
  local candidate
  for candidate in \
    "postgresql://postgres:postgres@${HOST}:${PORT}/tour_db" \
    "postgresql://postgres:postgres@${HOST}:${PORT}/postgres" \
    "postgresql://app_tour:app_tour@${HOST}:${PORT}/tour_db" \
    "postgresql://app_tour:app_tour@${HOST}:${PORT}/app_tour_dev"
  do
    if psql_ok "$candidate"; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}

if ! command -v psql >/dev/null 2>&1; then
  die "psql not found — install postgresql-client or unset DATABASE_URL to skip finance-ops"
fi

BOOTSTRAP_URL="$(pick_bootstrap_url)" || die "no Postgres on ${HOST}:${PORT} — run: pnpm run infra:up"

if ! psql "$BOOTSTRAP_URL" -v ON_ERROR_STOP=1 -tc "SELECT 1 FROM pg_database WHERE datname = 'tour_db'" | grep -q 1; then
  log "creating database tour_db"
  psql "$BOOTSTRAP_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE tour_db" >/dev/null
fi

TOUR_DB_ADMIN="postgresql://app_tour:app_tour@${HOST}:${PORT}/tour_db"
POSTGRES_ADMIN="postgresql://postgres:postgres@${HOST}:${PORT}/tour_db"
APP_ROLE_SQL="${ROOT}/docs/phase-4/dev/init/01-app-role.sql"
if [[ -f "$APP_ROLE_SQL" ]] && psql_ok "$POSTGRES_ADMIN"; then
  log "applying 01-app-role.sql via postgres (idempotent NOBYPASSRLS)"
  psql "$POSTGRES_ADMIN" -v ON_ERROR_STOP=1 -f "$APP_ROLE_SQL" >/dev/null
elif [[ -f "$APP_ROLE_SQL" ]] && psql_ok "$TOUR_DB_ADMIN"; then
  log "applying 01-app-role.sql on tour_db (postgres unavailable — best effort)"
  psql "$TOUR_DB_ADMIN" -v ON_ERROR_STOP=0 -f "$APP_ROLE_SQL" >/dev/null 2>&1 || true
fi

FINAL_DATABASE_URL="${DATABASE_URL:-postgresql://app_tour:app_tour@${HOST}:${PORT}/tour_db}"
FINAL_DATABASE_URL_ADMIN="$TOUR_DB_ADMIN"

if ! psql_ok "$FINAL_DATABASE_URL"; then
  FINAL_DATABASE_URL="postgresql://app_tour:app_tour@${HOST}:${PORT}/tour_db"
fi
if ! psql_ok "$FINAL_DATABASE_URL_ADMIN"; then
  FINAL_DATABASE_URL_ADMIN="postgresql://app_tour:app_tour@${HOST}:${PORT}/tour_db"
fi

log "migrate deploy on tour_db"
DATABASE_URL="$TOUR_DB_ADMIN" DATABASE_URL_ADMIN="$TOUR_DB_ADMIN" \
  pnpm --filter @apps/api run db:migrate:deploy >/dev/null 2>&1

log "ready DATABASE_URL=$FINAL_DATABASE_URL"
printf 'export DATABASE_URL=%q\n' "$FINAL_DATABASE_URL"
printf 'export DATABASE_URL_ADMIN=%q\n' "$FINAL_DATABASE_URL_ADMIN"
