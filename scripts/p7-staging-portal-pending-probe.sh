#!/usr/bin/env bash
# P7-2-N-002 — portal registration → pending row in operator workspace (~15s)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VPS_HOST="${VPS_HOST:-89.42.210.252}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_PATH="${VPS_DEPLOY_PATH:-/opt/app-tour-staging}"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
WEB_PORT="${STAGING_WEB_PORT:-23000}"
PTL_PORT="${STAGING_PORTAL_PORT:-23003}"
WEB="http://127.0.0.1:${WEB_PORT}"
PTL="http://127.0.0.1:${PTL_PORT}"
PHONE="${SMOKE_OPERATOR_OWNER_PHONE:-09174070937}"
OTP="${SMOKE_OPERATOR_OTP:-1234}"
ADMIN_HOST="${STAGING_OPERATOR_ADMIN_HOST:-admin.operator.localhost}"
PORTAL_HOST="${STAGING_PORTAL_HOST:-portal.operator.localhost}"
TOUR_ID="${STAGING_OPERATOR_TOUR_ID:-00000000-0000-4000-8000-000000000210}"
MEMBER_PHONE="${P7_PORTAL_MEMBER_PHONE:-+1555$(date +%s | tail -c 7)}"
GUEST_NAME="${P7_PORTAL_GUEST_NAME:-P7 Portal Guest}"
GUEST_EMAIL="${P7_PORTAL_GUEST_EMAIL:-p7-portal-guest-$(date +%s)@staging.test}"
PARTY_SIZE="${P7_PORTAL_PARTY_SIZE:-3}"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)

echo "== p7:staging-portal-pending-probe → ${VPS_USER}@${VPS_HOST} =="

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
DEPLOY_PATH="${DEPLOY_PATH}"
ENV_DIR="${ENV_DIR}"
WEB="${WEB}"
PTL="${PTL}"
PHONE="${PHONE}"
OTP="${OTP}"
ADMIN_HOST="${ADMIN_HOST}"
PORTAL_HOST="${PORTAL_HOST}"
TOUR_ID="${TOUR_ID}"
MEMBER_PHONE="${MEMBER_PHONE}"
GUEST_NAME="${GUEST_NAME}"
GUEST_EMAIL="${GUEST_EMAIL}"
PARTY_SIZE="${PARTY_SIZE}"

$(cat "${ROOT}/scripts/lib/p7-staging-portal-member-auth.sh")

ADMIN_HDR=( -H "Host: \${ADMIN_HOST}" )
fail() { echo "P7_STAGING_PORTAL_PENDING_PROBE_FAIL: \$1" >&2; exit 1; }

cd "\${DEPLOY_PATH}/apps/api"
set -a
# shellcheck source=/dev/null
source "\${ENV_DIR}/api.env"
set +a
NODE_ENV=development pnpm exec tsx scripts/seed-operator-smoke-identity-staging.ts >/tmp/p7-portal-pending-seed.log 2>&1 \\
  || fail "seed-operator-smoke-identity-staging failed — see /tmp/p7-portal-pending-seed.log"

MB_TOKEN=\$(p7_portal_member_session_token "\${MEMBER_PHONE}" "\${GUEST_NAME}") \\
  || fail "portal member OTP session failed for \${MEMBER_PHONE}"

reg=\$(p7_portal_post_catalog_registration "\${TOUR_ID}" "\${GUEST_EMAIL}" "\${GUEST_NAME}" "\${PARTY_SIZE}" "\${MB_TOKEN}")
echo "\$reg" | python3 -c "
import json, sys
body = json.loads(sys.stdin.read())
assert body.get('ok') is True, body
assert body.get('registrationId'), body
print('portal: registration created id=', body['registrationId'])
"

CID=\$(curl -sf -X POST "\${WEB}/api/auth/request-otp" "\${ADMIN_HDR[@]}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"phone\\":\\"\${PHONE}\\"}" \\
  | python3 -c "import json,sys; print(json.load(sys.stdin)['challenge_id'])")

TOKEN=\$(curl -sf -X POST "\${WEB}/api/auth/login-web-session" "\${ADMIN_HDR[@]}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"phone\\":\\"\${PHONE}\\",\\"otp\\":\\"\${OTP}\\",\\"challenge_id\\":\\"\${CID}\\"}" \\
  | python3 -c "import json,sys; print(json.load(sys.stdin)['session_token'])")

COOKIE=( -H "Cookie: atour_op_session=\${TOKEN}" )

bookings=\$(curl -sf "\${ADMIN_HDR[@]}" "\${COOKIE[@]}" \\
  "\${WEB}/api/bookings?tourId=\${TOUR_ID}&view=ops")
echo "\$bookings" | python3 -c "
import json, sys
body = json.loads(sys.stdin.read())
items = body.get('items') or []
match = [
  row for row in items
  if row.get('guestLabel') == '${GUEST_NAME}'
  and row.get('partySize') == ${PARTY_SIZE}
  and row.get('status') == 'pending'
]
assert match, f'pending row not found for ${GUEST_NAME} party=${PARTY_SIZE}: {items!r}'
print('workspace: pending row visible guest=', match[0]['guestLabel'], 'party=', match[0]['partySize'])
"

echo "P7_STAGING_PORTAL_PENDING_PROBE_OK"
EOF

echo "P7_STAGING_PORTAL_PENDING_PROBE_OK"
