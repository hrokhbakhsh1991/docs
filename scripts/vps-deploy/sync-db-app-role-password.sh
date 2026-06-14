#!/usr/bin/env bash
# Align Postgres app_tour password with DATABASE_URL (requires DATABASE_URL_ADMIN).
set -euo pipefail

ENV_FILE="${1:-/etc/app-tour/api.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "sync-db-app-role-password: missing env file: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "sync-db-app-role-password: DATABASE_URL is not set in $ENV_FILE" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL_ADMIN:-}" ]]; then
  echo "sync-db-app-role-password: DATABASE_URL_ADMIN is required" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "sync-db-app-role-password: psql not found — install postgresql-client" >&2
  exit 1
fi

APP_PASSWORD=$(
  python3 - <<'PY'
import os
from urllib.parse import urlparse, unquote

url = os.environ.get("DATABASE_URL", "")
password = unquote(urlparse(url).password or "")
if not password:
    raise SystemExit("sync-db-app-role-password: DATABASE_URL has no password")
print(password.replace("'", "''"))
PY
)

psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -c "ALTER USER app_tour WITH PASSWORD '${APP_PASSWORD}';"
echo "sync-db-app-role-password: OK — app_tour password aligned with DATABASE_URL"
