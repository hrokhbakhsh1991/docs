#!/usr/bin/env bash
# Print which Postgres / Redis / MinIO profile this host is using (prod vs dev).
set -euo pipefail

ENV_FILE="${1:-/etc/app-tour/api.env}"

red() { printf '\033[31m%s\033[0m\n' "$*"; }
grn() { printf '\033[32m%s\033[0m\n' "$*"; }
ylw() { printf '\033[33m%s\033[0m\n' "$*"; }

parse_url_field() {
  python3 - "$1" "$2" <<'PY'
import sys
from urllib.parse import urlparse, unquote
raw = sys.argv[1]
field = sys.argv[2]
u = urlparse(raw)
if field == "host":
    print(u.hostname or "")
elif field == "port":
    print(u.port or "")
elif field == "path":
    print((u.path or "").lstrip("/"))
elif field == "redis_db":
    path = (u.path or "").lstrip("/")
    print(path if path else "0")
PY
}

if [[ ! -f "$ENV_FILE" ]]; then
  red "missing env: $ENV_FILE"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

profile="${APP_INFRA_PROFILE:-unknown}"
node_env="${NODE_ENV:-unknown}"

echo "=== App Tour infra profile ==="
echo "env file:     $ENV_FILE"
echo "NODE_ENV:     $node_env"
echo "APP_INFRA:    $profile"

if [[ "$profile" == "production" && "$node_env" == "production" ]]; then
  grn "✓ production profile markers OK"
elif [[ "$profile" == "development" || "$node_env" == "development" ]]; then
  ylw "! development markers — do NOT use for operator production"
else
  ylw "! profile markers missing or mixed — check api.env"
fi

echo ""
echo "--- Postgres ---"
if [[ -n "${DATABASE_URL:-}" ]]; then
  db_host=$(parse_url_field "$DATABASE_URL" host)
  db_port=$(parse_url_field "$DATABASE_URL" port)
  db_name=$(parse_url_field "$DATABASE_URL" path)
  echo "DATABASE_URL host:port/db = ${db_host}:${db_port}/${db_name}"
  case "${db_name}:${db_port}" in
    tour_db_prod:5433) grn "  → VPS production (native :5433)" ;;
    tour_db:5433) red "  → LEGACY name on prod port — should be tour_db_prod" ;;
    tour_db:5434|app_tour_dev:5434|tour_db:5434) grn "  → local/CI dev (Docker :5434)" ;;
    *) ylw "  → unrecognized — verify manually" ;;
  esac
else
  red "DATABASE_URL unset"
fi

echo ""
echo "--- Redis ---"
if [[ -n "${REDIS_URL:-}" ]]; then
  redis_host=$(parse_url_field "$REDIS_URL" host)
  redis_port=$(parse_url_field "$REDIS_URL" port)
  redis_db=$(parse_url_field "$REDIS_URL" redis_db)
  echo "REDIS_URL = ${redis_host}:${redis_port:-6379} logical db ${redis_db}"
  case "${redis_host}:${redis_port:-6379}:${redis_db}" in
    127.0.0.1:6379:1) grn "  → VPS production (native :6379 db 1)" ;;
    127.0.0.1:6379:0) ylw "  → shared Redis db 0 (dev default — prod should use /1)" ;;
    127.0.0.1:6380:*) grn "  → dev Docker Redis (:6380)" ;;
    *) ylw "  → verify against deploy/vps/README.md matrix" ;;
  esac
else
  red "REDIS_URL unset"
fi

echo ""
echo "--- MinIO ---"
echo "MINIO_ENDPOINT = ${MINIO_ENDPOINT:-unset}"
echo "MINIO_BUCKET     = ${MINIO_BUCKET:-unset}"
case "${MINIO_BUCKET:-}" in
  app-tour-prod) grn "  → VPS production bucket" ;;
  app-tour-dev) grn "  → dev bucket (local Docker / CI)" ;;
  *) ylw "  → unexpected bucket name" ;;
esac

echo ""
echo "--- Same-server cheat sheet ---"
cat <<'EOF'
| Layer   | PRODUCTION (operator VPS)     | DEV (local laptop)              |
|---------|-------------------------------|---------------------------------|
| Postgres| 127.0.0.1:5433 / tour_db_prod | 127.0.0.1:5434 / tour_db (Docker)|
| Redis   | 127.0.0.1:6379 / db 1         | 127.0.0.1:6379 / db 0 (Docker)  |
| MinIO   | :9002 bucket app-tour-prod    | :9002 bucket app-tour-dev       |
| Env     | /etc/app-tour/api.env         | apps/api/.env.local             |

Never SSH-tunnel VPS :5433 into local .env.local — that hits production.
Use pnpm infra:up + .env.local.example for isolated dev.
EOF

if command -v psql >/dev/null 2>&1 && [[ -n "${DATABASE_URL:-}" ]]; then
  echo ""
  echo "--- live probe ---"
  if psql "${DATABASE_URL%%\?*}" -c "SELECT current_database() AS db, current_user AS role" 2>/dev/null; then
    grn "Postgres connection OK"
  else
    red "Postgres connection FAILED"
  fi
fi
