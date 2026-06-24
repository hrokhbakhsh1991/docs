#!/usr/bin/env bash
# P7-0-N-003 — idempotent operator smoke seed bundle (VPS-safe, no full db:seed)
# @see docs/phase-20/p7/appendices/P7-CUSTOMER-SEED-DELTA.md
set -euo pipefail

VPS_HOST="${VPS_HOST:-89.45.89.206}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_PATH="${VPS_DEPLOY_PATH:-/opt/app-tour-staging}"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)

echo "== p7:staging-seed-bundle → ${VPS_HOST} =="

rsync -az \
  "${ROOT}/apps/api/scripts/seed-operator-staging.ts" \
  "${ROOT}/apps/api/scripts/seed-denali-dev-catalog-staging.ts" \
  "${ROOT}/apps/api/scripts/seed-operator-smoke-identity-staging.ts" \
  "${ROOT}/apps/api/scripts/ensure-operator-smoke-vs01-staging.ts" \
  "${ROOT}/apps/api/scripts/seed-operator-smoke-pending-booking-staging.ts" \
  "${ROOT}/apps/api/scripts/seed-operator-smoke-finance-receipt-staging.ts" \
  "${ROOT}/apps/api/scripts/seed-operator-smoke-waitlist-staging.ts" \
  "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/apps/api/scripts/"
rsync -az \
  "${ROOT}/apps/api/src/bookings/prisma-bookings.repository.ts" \
  "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/apps/api/src/bookings/"
rsync -az \
  "${ROOT}/apps/api/src/settings/seed-operator-smoke-published-tour.ts" \
  "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/apps/api/src/settings/"

MKT_PORT="${STAGING_MARKETING_PORT:-23002}"
PTL_PORT="${STAGING_PORTAL_PORT:-23003}"

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
DEPLOY_PATH="${DEPLOY_PATH}"
ENV_DIR="${ENV_DIR}"
MKT_PORT="${MKT_PORT}"
PTL_PORT="${PTL_PORT}"
cd "\${DEPLOY_PATH}/apps/api"
set -a
# shellcheck source=/dev/null
source "\${ENV_DIR}/api.env"
set +a

systemctl restart app-tour-staging-api app-tour-staging-marketing app-tour-staging-portal
sleep 3
systemctl is-active app-tour-staging-api app-tour-staging-marketing app-tour-staging-portal

for script in \\
  scripts/seed-operator-staging.ts \\
  scripts/seed-operator-smoke-identity-staging.ts \\
  scripts/ensure-operator-smoke-vs01-staging.ts \\
  scripts/seed-operator-smoke-pending-booking-staging.ts \\
  scripts/seed-operator-smoke-finance-receipt-staging.ts
do
  NODE_ENV=development pnpm exec tsx "\$script"
done

MKT_ENV="\${ENV_DIR}/marketing.env"
PORTAL_BASE="http://operator.portal.localhost:\${PTL_PORT}"
if grep -q '^PORTAL_PUBLIC_BASE_URL=' "\$MKT_ENV"; then
  sed -i "s|^PORTAL_PUBLIC_BASE_URL=.*|PORTAL_PUBLIC_BASE_URL=\${PORTAL_BASE}|" "\$MKT_ENV"
else
  echo "PORTAL_PUBLIC_BASE_URL=\${PORTAL_BASE}" >> "\$MKT_ENV"
fi
systemctl restart app-tour-staging-marketing app-tour-staging-portal
sleep 2
systemctl is-active app-tour-staging-marketing app-tour-staging-portal
EOF

echo "P7_STAGING_SEED_BUNDLE_OK"
