#!/usr/bin/env bash
# P7-2-N-001 — workspace registrations tourId preset probe (~12s)
set -euo pipefail

VPS_HOST="${VPS_HOST:-89.42.210.252}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_PATH="${VPS_DEPLOY_PATH:-/opt/app-tour-staging}"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
WEB_PORT="${STAGING_WEB_PORT:-23000}"
WEB="http://127.0.0.1:${WEB_PORT}"
PHONE="${SMOKE_OPERATOR_OWNER_PHONE:-09174070937}"
OTP="${SMOKE_OPERATOR_OTP:-1234}"
ADMIN_HOST="${STAGING_OPERATOR_ADMIN_HOST:-operator.admin.localhost}"
TOUR_ID="${STAGING_OPERATOR_TOUR_ID:-00000000-0000-4000-8000-000000000210}"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)

echo "== p7:staging-workspace-registrations-probe → ${VPS_USER}@${VPS_HOST} =="

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
DEPLOY_PATH="${DEPLOY_PATH}"
ENV_DIR="${ENV_DIR}"
WEB="${WEB}"
PHONE="${PHONE}"
OTP="${OTP}"
ADMIN_HOST="${ADMIN_HOST}"
TOUR_ID="${TOUR_ID}"

HOST_HDR=( -H "Host: \${ADMIN_HOST}" )
fail() { echo "P7_STAGING_WORKSPACE_REGISTRATIONS_PROBE_FAIL: \$1" >&2; exit 1; }

cd "\${DEPLOY_PATH}/apps/api"
set -a
# shellcheck source=/dev/null
source "\${ENV_DIR}/api.env"
set +a
NODE_ENV=development pnpm exec tsx scripts/seed-operator-smoke-identity-staging.ts >/tmp/p7-ws-reg-seed.log 2>&1 \\
  || fail "seed-operator-smoke-identity-staging failed — see /tmp/p7-ws-reg-seed.log"

CID=\$(curl -sf -X POST "\${WEB}/api/auth/request-otp" "\${HOST_HDR[@]}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"phone\\":\\"\${PHONE}\\"}" \\
  | python3 -c "import json,sys; print(json.load(sys.stdin)['challenge_id'])")

TOKEN=\$(curl -sf -X POST "\${WEB}/api/auth/login-web-session" "\${HOST_HDR[@]}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"phone\\":\\"\${PHONE}\\",\\"otp\\":\\"\${OTP}\\",\\"challenge_id\\":\\"\${CID}\\"}" \\
  | python3 -c "import json,sys; print(json.load(sys.stdin)['session_token'])")

COOKIE=( -H "Cookie: session=\${TOKEN}" )

ws_code=\$(curl -sS -o /tmp/p7-ws-reg.html -w '%{http_code}' \\
  "\${HOST_HDR[@]}" "\${COOKIE[@]}" "\${WEB}/tours/\${TOUR_ID}/workspace")
[[ "\$ws_code" == "200" ]] || fail "workspace page HTTP \${ws_code}"

grep -q 'data-testid="operator-tour-workspace-registrations-panel"' /tmp/p7-ws-reg.html \\
  || fail "registrations panel marker missing"
grep -q "/tours/\${TOUR_ID}/register" /tmp/p7-ws-reg.html \\
  || fail "register link missing tourId in path"
grep -q "tourId=\${TOUR_ID}" /tmp/p7-ws-reg.html \\
  || fail "command center link missing tourId query"
echo "ui: workspace registrations panel + tour-scoped links"

bookings=\$(curl -sf "\${HOST_HDR[@]}" "\${COOKIE[@]}" \\
  "\${WEB}/api/bookings?tourId=\${TOUR_ID}&view=ops")
echo "\$bookings" | python3 -c "
import json, sys
body = json.loads(sys.stdin.read())
assert isinstance(body.get('items'), list), body
print('api: GET /api/bookings tourId+view=ops OK items=', len(body['items']))
"

echo "P7_STAGING_WORKSPACE_REGISTRATIONS_PROBE_OK"
EOF

echo "P7_STAGING_WORKSPACE_REGISTRATIONS_PROBE_OK"
