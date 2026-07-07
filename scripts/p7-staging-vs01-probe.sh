#!/usr/bin/env bash
# P7-1-N-009 — VS-01 staging probe (~12s) — SMK-P6-VS-01 equivalent via curl
set -euo pipefail

VPS_HOST="${VPS_HOST:-89.45.89.206}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_PATH="${VPS_DEPLOY_PATH:-/opt/app-tour-staging}"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
API_PORT="${STAGING_API_PORT:-23001}"
MKT_PORT="${STAGING_MARKETING_PORT:-23002}"
API="http://127.0.0.1:${API_PORT}"
MKT="http://127.0.0.1:${MKT_PORT}"
OPERATOR_TENANT="00000000-0000-4000-8000-000000000014"
PUBLISHED_TOUR_ID="00000000-0000-4000-8000-000000000210"
DRAFT_TOUR_ID="00000000-0000-4000-8000-000000000211"
PUBLISHED_TITLE="North Ridge Trek"
DRAFT_TITLE="Denali draft fixture"
MARKETING_HOST="${STAGING_MARKETING_HOST:-operator.localhost}"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)

echo "== p7:staging-vs01-probe → ${VPS_USER}@${VPS_HOST} =="

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
DEPLOY_PATH="${DEPLOY_PATH}"
ENV_DIR="${ENV_DIR}"
API="${API}"
MKT="${MKT}"
OPERATOR_TENANT="${OPERATOR_TENANT}"
PUBLISHED_TOUR_ID="${PUBLISHED_TOUR_ID}"
DRAFT_TOUR_ID="${DRAFT_TOUR_ID}"
PUBLISHED_TITLE="${PUBLISHED_TITLE}"
DRAFT_TITLE="${DRAFT_TITLE}"
MARKETING_HOST="${MARKETING_HOST}"

fail() { echo "P7_STAGING_VS01_PROBE_FAIL: \$1" >&2; exit 1; }

cd "\${DEPLOY_PATH}/apps/api"
set -a
# shellcheck source=/dev/null
source "\${ENV_DIR}/api.env"
set +a
NODE_ENV=development pnpm exec tsx scripts/ensure-operator-smoke-vs01-staging.ts >/tmp/p7-vs01-seed.log 2>&1 \\
  || fail "ensure-operator-smoke-vs01-staging failed — see /tmp/p7-vs01-seed.log"

catalog=\$(curl -sf "\${API}/denali/catalog" -H "x-tenant-id: \${OPERATOR_TENANT}")
echo "\$catalog" | python3 -c "
import json, sys
body = json.loads(sys.stdin.read())
items = (body.get('data') or {}).get('items') or []
titles = [((item.get('title') or '').strip()) for item in items]
assert '${PUBLISHED_TITLE}' in titles, f'published title missing: {titles!r}'
assert '${DRAFT_TITLE}' not in titles, f'draft title leaked to catalog: {titles!r}'
print('api catalog: active listed · draft hidden')
"

draft_code=\$(curl -sS -o /dev/null -w '%{http_code}' \\
  "\${API}/denali/catalog/\${DRAFT_TOUR_ID}" -H "x-tenant-id: \${OPERATOR_TENANT}")
[[ "\$draft_code" == "404" ]] || fail "draft tour catalog detail expected 404 got \${draft_code}"

pub_code=\$(curl -sS -o /dev/null -w '%{http_code}' \\
  "\${API}/denali/catalog/\${PUBLISHED_TOUR_ID}" -H "x-tenant-id: \${OPERATOR_TENANT}")
[[ "\$pub_code" == "200" ]] || fail "published tour catalog detail expected 200 got \${pub_code}"
echo "api detail: draft=404 published=200"

html=\$(curl -sS -H "Host: \${MARKETING_HOST}" "\${MKT}/tours")
echo "\$html" | grep -q "\${PUBLISHED_TITLE}" || fail "marketing /tours missing published title"
echo "\$html" | grep -q "\${PUBLISHED_TOUR_ID}" || fail "marketing /tours missing published tour id"
echo "\$html" | grep -q "\${DRAFT_TITLE}" && fail "marketing /tours leaked draft title"
echo "\$html" | grep -q "\${DRAFT_TOUR_ID}" && fail "marketing /tours leaked draft tour id"
echo "marketing: active on /tours · draft absent"

echo "P7_STAGING_VS01_PROBE_OK"
EOF

echo "P7_STAGING_VS01_PROBE_OK"
