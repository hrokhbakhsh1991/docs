#!/usr/bin/env bash
# Reset tenant/data tables for local Postgres (RLS integration loops).
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
SQL="$ROOT/infra/sql/test-reset.sql"

if [ ! -f "$SQL" ]; then
  echo "db-test-reset: missing $SQL" >&2
  exit 1
fi

# Default: Phase 4 dev compose (docs/phase-4/ci.md) — admin URL for TRUNCATE.
DEFAULT_URL="postgresql://postgres:postgres@localhost:${PHASE4_DB_PORT:-5434}/tour_db"
DB_URL="${DATABASE_URL_ADMIN:-${DATABASE_URL:-$DEFAULT_URL}}"

if [ "${NODE_ENV:-}" = "production" ]; then
  echo "db-test-reset: refused — NODE_ENV=production (DEC-095 / CAE-GAP-05)" >&2
  exit 1
fi

db_test_reset_url_looks_prod() {
  case "$1" in
    *prod* | *production* | *.rds.* | *azure* | *cloudsql* | *neon.tech*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

if db_test_reset_url_looks_prod "$DB_URL" && [ "${CONFIRM_TEST_RESET:-}" != "1" ]; then
  echo "db-test-reset: refused — URL looks like production; set CONFIRM_TEST_RESET=1 to override (DEC-095)" >&2
  exit 1
fi

if [ "${CONFIRM_TEST_RESET:-}" = "1" ]; then
  echo "db-test-reset: WARNING — CONFIRM_TEST_RESET=1 acknowledged for $DB_URL" >&2
fi

echo "db-test-reset: applying $SQL"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SQL"
psql "$DB_URL" -v ON_ERROR_STOP=1 -c 'ALTER TABLE tours ADD COLUMN IF NOT EXISTS row_version INT NOT NULL DEFAULT 1;'
echo "db-test-reset: PASS"
