#!/usr/bin/env bash
# Required before first prisma migrate on native Postgres 12 (gen_random_uuid).
set -euo pipefail

ENV_FILE="${1:-/etc/app-tour/api.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ensure-prod-postgres-extensions: missing $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${DATABASE_URL_ADMIN:-}" ]]; then
  echo "ensure-prod-postgres-extensions: DATABASE_URL_ADMIN required" >&2
  exit 1
fi

db_name=$(
  python3 - <<'PY'
import os
from urllib.parse import urlparse
url = os.environ.get("DATABASE_URL_ADMIN", "")
print((urlparse(url).path or "").lstrip("/"))
PY
)

if [[ -z "$db_name" ]]; then
  echo "ensure-prod-postgres-extensions: could not parse database name" >&2
  exit 1
fi

admin_base="${DATABASE_URL_ADMIN%%\?*}"

if psql "$admin_base" -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;' >/dev/null 2>&1; then
  echo "ensure-prod-postgres-extensions: OK — pgcrypto on ${db_name}"
  exit 0
fi

echo "ensure-prod-postgres-extensions: trying sudo -u postgres for ${db_name}" >&2
port=$(
  python3 - <<'PY'
import os
from urllib.parse import urlparse
url = os.environ.get("DATABASE_URL_ADMIN", "")
print(urlparse(url).port or 5432)
PY
)
sudo -u postgres psql -p "$port" -d "$db_name" -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;'
echo "ensure-prod-postgres-extensions: OK — pgcrypto on ${db_name}"
