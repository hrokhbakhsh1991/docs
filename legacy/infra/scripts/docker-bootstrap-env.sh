#!/usr/bin/env bash
# Generates infra/.env.docker with fresh RS256 keys for local Docker Compose (development only).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUT="${INFRA_DIR}/.env.docker"

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required to generate JWT keys." >&2
  exit 1
fi

umask 077
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

openssl genrsa -out "${TMP}/key.pem" 2048 >/dev/null 2>&1
openssl pkcs8 -topk8 -nocrypt -in "${TMP}/key.pem" -out "${TMP}/priv.pem"
openssl rsa -in "${TMP}/key.pem" -pubout -out "${TMP}/pub.pem"

priv_esc=$(awk '{printf "%s\\n", $0}' "${TMP}/priv.pem" | sed 's/\\n$//')
pub_esc=$(awk '{printf "%s\\n", $0}' "${TMP}/pub.pem" | sed 's/\\n$//')

cat > "${OUT}" <<EOF
NODE_ENV=production
LOG_LEVEL=info
PORT=3001

DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_USER=tour_ops
DATABASE_PASSWORD=tour_ops
DATABASE_NAME=tour_ops_dev
DATABASE_URL=postgresql://tour_ops:tour_ops@postgres:5432/tour_ops_dev

JWT_PRIVATE_KEY="${priv_esc}"
JWT_PUBLIC_KEY="${pub_esc}"
JWT_ISSUER=tour-ops-docker
JWT_AUDIENCE=tour-ops-web
TELEGRAM_BOT_TOKEN=dummy-telegram-token-docker-only

REDIS_HOST=redis
REDIS_PORT=6379

MINIO_ENDPOINT=minio
MINIO_PORT=9002
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false
MINIO_BUCKET=receipts

CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000

ENABLE_SCHEDULERS=true
APP_RUNTIME_ROLE=all
JOB_SCHEDULER_JITTER_MS=500
INTERNAL_API_KEY=dev-docker-internal-key-change-me

OUTBOX_PROCESSOR_ENABLED=true
OUTBOX_POLL_INTERVAL_MS=5000
OUTBOX_MAX_RETRY=5
OUTBOX_BATCH_SIZE=50

RECONCILIATION_ENABLED=false
RECONCILIATION_INTERVAL_MS=600000

PAYMENTS_TIMEOUT_ENABLED=true
PAYMENTS_TIMEOUT_INTERVAL_MS=60000

# Uncomment when using infra/docker-compose.observability.yml (Jaeger all-in-one)
# OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
EOF

chmod 600 "${OUT}"
echo "Wrote ${OUT} (do not commit; keys are for local containers only)."
