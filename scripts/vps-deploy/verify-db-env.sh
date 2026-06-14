#!/usr/bin/env bash
# Verify DATABASE_URL credentials against Postgres before restarting app-tour-api.
set -euo pipefail

ENV_FILE="${1:-/etc/app-tour/api.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "verify-db-env: missing env file: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "verify-db-env: DATABASE_URL is not set in $ENV_FILE" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "verify-db-env: psql not found — install postgresql-client" >&2
  exit 1
fi

if psql "$DATABASE_URL" -c "SELECT 1" >/dev/null 2>&1; then
  echo "verify-db-env: OK — DATABASE_URL connects"
  exit 0
fi

echo "verify-db-env: FAIL — password authentication failed for DATABASE_URL" >&2
echo "hint: align app_tour password with Postgres, e.g.:" >&2
echo "  bash $(dirname "$0")/sync-db-app-role-password.sh $ENV_FILE" >&2
echo "  or: sudo -u postgres psql -c \"ALTER USER app_tour WITH PASSWORD 'YOUR_PASSWORD';\"" >&2
exit 1
