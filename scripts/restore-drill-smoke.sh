#!/usr/bin/env bash
# DEC-125 — logical backup/restore smoke (proves drill mechanics on disposable DB).
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -z "${DATABASE_URL_ADMIN:-}" ]]; then
  echo "restore-drill-smoke: FAIL — DATABASE_URL_ADMIN required" >&2
  exit 1
fi

for cmd in psql pg_dump; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "restore-drill-smoke: FAIL — $cmd not found" >&2
    exit 1
  fi
done

ADMIN_URL="$DATABASE_URL_ADMIN"
SOURCE_DB="$(psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -tA -c "SELECT current_database();")"
TMP_DB="restore_drill_${SOURCE_DB}_$(date +%s)"
DUMP_FILE="$(mktemp /tmp/restore-drill-XXXXXX.sql)"
RESTORE_URL="${ADMIN_URL%/*}/${TMP_DB}"

count_table() {
  local url="$1"
  local table="$2"
  psql "$url" -v ON_ERROR_STOP=1 -tA -c "SELECT COUNT(*) FROM ${table};"
}

count_migrations() {
  local url="$1"
  psql "$url" -v ON_ERROR_STOP=1 -tA -c "SELECT COUNT(*) FROM _prisma_migrations;"
}

cleanup() {
  if [[ "${RESTORE_DRILL_SKIP_DROP:-}" != "1" ]]; then
    psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${TMP_DB}\";" >/dev/null 2>&1 || true
  fi
  rm -f "$DUMP_FILE"
}
trap cleanup EXIT

TENANTS_BEFORE="$(count_table "$ADMIN_URL" tenants)"
TOURS_BEFORE="$(count_table "$ADMIN_URL" tours)"
MIGRATIONS_BEFORE="$(count_migrations "$ADMIN_URL")"

pg_dump "$ADMIN_URL" --no-owner --no-acl -f "$DUMP_FILE"

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${TMP_DB}\";"
psql "$RESTORE_URL" -v ON_ERROR_STOP=1 -f "$DUMP_FILE" >/dev/null

TENANTS_AFTER="$(count_table "$RESTORE_URL" tenants)"
TOURS_AFTER="$(count_table "$RESTORE_URL" tours)"
MIGRATIONS_AFTER="$(count_migrations "$RESTORE_URL")"

if [[ "$TENANTS_BEFORE" != "$TENANTS_AFTER" || "$TOURS_BEFORE" != "$TOURS_AFTER" || "$MIGRATIONS_BEFORE" != "$MIGRATIONS_AFTER" ]]; then
  echo "restore-drill-smoke: FAIL — count mismatch" >&2
  echo "  tenants: ${TENANTS_BEFORE} -> ${TENANTS_AFTER}" >&2
  echo "  tours: ${TOURS_BEFORE} -> ${TOURS_AFTER}" >&2
  echo "  migrations: ${MIGRATIONS_BEFORE} -> ${MIGRATIONS_AFTER}" >&2
  exit 1
fi

cat <<EOF
restore-drill-smoke: PASS
{"sourceDb":"${SOURCE_DB}","restoreDb":"${TMP_DB}","tenants":${TENANTS_AFTER},"tours":${TOURS_AFTER},"migrations":${MIGRATIONS_AFTER}}
EOF
