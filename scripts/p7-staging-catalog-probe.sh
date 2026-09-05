#!/usr/bin/env bash
# P7-1-N-006 — staging catalog + revalidate probe (~10s)
set -euo pipefail

VPS_HOST="${VPS_HOST:-89.42.210.252}"
VPS_USER="${VPS_USER:-root}"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
API_PORT="${STAGING_API_PORT:-23001}"
MKT_PORT="${STAGING_MARKETING_PORT:-23002}"
API="http://127.0.0.1:${API_PORT}"
MKT="http://127.0.0.1:${MKT_PORT}"
OPERATOR_TENANT="00000000-0000-4000-8000-000000000014"
SEED_TOUR_ID="00000000-0000-4000-8000-000000000210"
MARKETING_HOST="${STAGING_MARKETING_HOST:-operator.localhost}"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)

echo "== p7:staging-catalog-probe → ${VPS_USER}@${VPS_HOST} =="

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
ENV_DIR="${ENV_DIR}"
API="${API}"
MKT="${MKT}"
OPERATOR_TENANT="${OPERATOR_TENANT}"
SEED_TOUR_ID="${SEED_TOUR_ID}"
MARKETING_HOST="${MARKETING_HOST}"

fail() { echo "P7_STAGING_CATALOG_PROBE_FAIL: \$1" >&2; exit 1; }

api_env="\${ENV_DIR}/api.env"
grep -q '^MARKETING_REVALIDATE_URL=' "\$api_env" || fail "MARKETING_REVALIDATE_URL missing in api.env (run p7:configure-staging-revalidate)"
grep -q '^MARKETING_REVALIDATE_SECRET=' "\$api_env" || fail "MARKETING_REVALIDATE_SECRET missing in api.env"

rev_url=\$(grep '^MARKETING_REVALIDATE_URL=' "\$api_env" | tail -1 | cut -d= -f2- | tr -d '\r')
rev_secret=\$(grep '^MARKETING_REVALIDATE_SECRET=' "\$api_env" | tail -1 | cut -d= -f2- | tr -d '\r')
mkt_secret=\$(grep '^MARKETING_REVALIDATE_SECRET=' "\${ENV_DIR}/marketing.env" | tail -1 | cut -d= -f2- | tr -d '\r')
[[ "\$rev_secret" == "\$mkt_secret" ]] || fail "api/marketing MARKETING_REVALIDATE_SECRET mismatch"

cat_count=\$(curl -sf "\${API}/denali/catalog" -H "x-tenant-id: \${OPERATOR_TENANT}" \\
  | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('data',{}).get('items',[])))")
echo "api catalog items=\${cat_count}"
[[ "\$cat_count" -ge 1 ]] || fail "no published tours in API catalog"

curl -sf "\${API}/denali/catalog/\${SEED_TOUR_ID}" -H "x-tenant-id: \${OPERATOR_TENANT}" >/dev/null \\
  || fail "seed tour not in catalog"

html=\$(curl -sS -H "Host: \${MARKETING_HOST}" "\${MKT}/tours")
echo "\$html" | grep -q 'North Ridge Trek' || fail "marketing /tours missing North Ridge Trek"
echo "\$html" | grep -q "\${SEED_TOUR_ID}" || fail "marketing /tours missing seed tour id"

rev_code=\$(curl -sS -o /tmp/p7-rev.json -w '%{http_code}' -X POST "\${rev_url}/api/revalidate" \\
  -H "content-type: application/json" \\
  -H "x-marketing-revalidate-secret: \${rev_secret}" \\
  -d "{\\"tenantId\\":\\"\${OPERATOR_TENANT}\\"}")
[[ "\$rev_code" == "200" ]] || fail "revalidate POST HTTP \${rev_code}"
grep -q '"revalidated":true' /tmp/p7-rev.json || fail "revalidate body unexpected"
echo "revalidate: HTTP 200 revalidated=true"

echo "P7_STAGING_CATALOG_PROBE_OK"
EOF

echo "P7_STAGING_CATALOG_PROBE_OK"
