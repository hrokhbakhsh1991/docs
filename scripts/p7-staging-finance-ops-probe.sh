#!/usr/bin/env bash
# P7-3-N-002 — T3 finance-ops on staging Postgres (~30s)
set -euo pipefail

VPS_HOST="${VPS_HOST:-89.45.89.206}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_PATH="${VPS_DEPLOY_PATH:-/opt/app-tour-staging}"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)

echo "== p7:staging-finance-ops-probe → ${VPS_USER}@${VPS_HOST} =="

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
DEPLOY_PATH="${DEPLOY_PATH}"
ENV_DIR="${ENV_DIR}"

fail() { echo "P7_STAGING_FINANCE_OPS_PROBE_FAIL: \$1" >&2; exit 1; }

set -a
# shellcheck source=/dev/null
source "\${ENV_DIR}/api.env"
set +a

[[ -n "\${DATABASE_URL:-}" ]] || fail "DATABASE_URL missing in \${ENV_DIR}/api.env"
export STORAGE_DRIVER="\${STORAGE_DRIVER:-prisma}"
export NODE_ENV="\${NODE_ENV:-development}"

cd "\${DEPLOY_PATH}/apps/api"
env STORAGE_DRIVER="\${STORAGE_DRIVER}" NODE_ENV=test \\
  APPS_API_TEST_TIER=trunk OUTBOX_RELAY_ENABLED=false \\
  PROJECTION_AUTO_RECONCILE_ENABLED=false TENANT_RATE_LIMIT_ENABLED=false \\
  pnpm exec node --import tsx --import ./test/bootstrap-outbox-test-env.ts \\
  --test --test-force-exit --test-concurrency=1 test/finance-ops.spec.ts

echo "P7_STAGING_FINANCE_OPS_PROBE_OK"
EOF

echo "P7_STAGING_FINANCE_OPS_PROBE_OK"
