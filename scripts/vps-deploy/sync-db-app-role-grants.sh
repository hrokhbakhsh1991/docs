#!/usr/bin/env bash
# Grant app_tour role access to all objects in the production database (Postgres 12 native).
set -euo pipefail

ENV_FILE="${1:-/etc/app-tour/api.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "sync-db-app-role-grants: missing $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

db_name=$(
  python3 - <<'PY'
import os
from urllib.parse import urlparse
print((urlparse(os.environ.get("DATABASE_URL_ADMIN", "")).path or "").lstrip("/"))
PY
)

port=$(
  python3 - <<'PY'
import os
from urllib.parse import urlparse
print(urlparse(os.environ.get("DATABASE_URL_ADMIN", "")).port or 5432)
PY
)

if [[ -z "$db_name" ]]; then
  echo "sync-db-app-role-grants: could not parse database name" >&2
  exit 1
fi

sudo -u postgres psql -p "$port" -d "$db_name" -v ON_ERROR_STOP=1 <<SQL
GRANT CONNECT ON DATABASE ${db_name} TO app_tour;
GRANT USAGE ON SCHEMA public TO app_tour;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_tour;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_tour;
GRANT SELECT ON TABLE _prisma_migrations TO app_tour;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_tour;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_tour;
SQL

echo "sync-db-app-role-grants: OK — app_tour grants on ${db_name}"
