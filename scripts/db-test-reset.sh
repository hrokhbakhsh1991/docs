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

echo "db-test-reset: applying $SQL"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SQL"
echo "db-test-reset: PASS"
