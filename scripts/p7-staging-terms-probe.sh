#!/usr/bin/env bash
# P7-1-N-008 — staging tour policies/terms probe (~15s)
set -euo pipefail

VPS_HOST="${VPS_HOST:-89.42.210.252}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_PATH="${VPS_DEPLOY_PATH:-/opt/app-tour-staging}"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
API_PORT="${STAGING_API_PORT:-23001}"
MKT_PORT="${STAGING_MARKETING_PORT:-23002}"
PTL_PORT="${STAGING_PORTAL_PORT:-23003}"
API="http://127.0.0.1:${API_PORT}"
MKT="http://127.0.0.1:${MKT_PORT}"
PTL="http://127.0.0.1:${PTL_PORT}"
OPERATOR_TENANT="00000000-0000-4000-8000-000000000014"
SEED_TOUR_ID="00000000-0000-4000-8000-000000000210"
MARKER="P7 staging: cancel 48h"
MARKETING_HOST="${STAGING_MARKETING_HOST:-operator.localhost}"
PORTAL_HOST="${STAGING_PORTAL_HOST:-operator.portal.localhost}"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)

echo "== p7:staging-terms-probe → ${VPS_USER}@${VPS_HOST} =="

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
DEPLOY_PATH="${DEPLOY_PATH}"
ENV_DIR="${ENV_DIR}"
API="${API}"
MKT="${MKT}"
PTL="${PTL}"
OPERATOR_TENANT="${OPERATOR_TENANT}"
SEED_TOUR_ID="${SEED_TOUR_ID}"
MARKER="${MARKER}"
MARKETING_HOST="${MARKETING_HOST}"
PORTAL_HOST="${PORTAL_HOST}"

fail() { echo "P7_STAGING_TERMS_PROBE_FAIL: \$1" >&2; exit 1; }

cd "\${DEPLOY_PATH}/apps/api"
set -a
# shellcheck source=/dev/null
source "\${ENV_DIR}/api.env"
set +a
NODE_ENV=development pnpm exec tsx scripts/ensure-operator-smoke-policies-staging.ts >/tmp/p7-seed-terms.log 2>&1 \\
  || fail "ensure-operator-smoke-policies-staging failed — see /tmp/p7-seed-terms.log"

detail=\$(curl -sf "\${API}/denali/catalog/\${SEED_TOUR_ID}" -H "x-tenant-id: \${OPERATOR_TENANT}")
echo "\$detail" | python3 -c "
import json, sys
body = json.loads(sys.stdin.read())
data = body.get('data') or {}
text = data.get('policiesText') or ''
assert '${MARKER}' in text, f'policiesText missing marker: {text!r}'
hours = data.get('cancellationDeadlineHours')
assert hours == 48, f'cancellationDeadlineHours={hours!r}'
print('api: policiesText ok · deadlineHours=48')
"

mkt_html=\$(curl -sS -H "Host: \${MARKETING_HOST}" "\${MKT}/tours/\${SEED_TOUR_ID}")
echo "\$mkt_html" | grep -q 'data-tour-policies-text' \\
  || fail "marketing detail missing data-tour-policies-text (rebuild marketing on VPS)"
echo "\$mkt_html" | grep -q "\${MARKER}" \\
  || fail "marketing detail missing policies marker text"

ptl_html=\$(curl -sS -H "Host: \${PORTAL_HOST}" "\${PTL}/catalog/\${SEED_TOUR_ID}/register")
echo "\$ptl_html" | grep -q 'data-tour-policies-text' \\
  || fail "portal register missing data-tour-policies-text (rebuild portal on VPS)"
echo "\$ptl_html" | grep -q "\${MARKER}" \\
  || fail "portal register missing policies marker text"

echo "P7_STAGING_TERMS_PROBE_OK"
EOF

echo "P7_STAGING_TERMS_PROBE_OK"
