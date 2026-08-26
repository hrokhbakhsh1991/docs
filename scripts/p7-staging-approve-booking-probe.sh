#!/usr/bin/env bash
# P7-2-N-003 — portal register → operator approve → approved + outbox (~18s)
set -euo pipefail

VPS_HOST="${VPS_HOST:-89.45.89.206}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_PATH="${VPS_DEPLOY_PATH:-/opt/app-tour-staging}"
ENV_DIR="${ENV_DIR:-/etc/app-tour-staging}"
WEB_PORT="${STAGING_WEB_PORT:-23000}"
PTL_PORT="${STAGING_PORTAL_PORT:-23003}"
WEB="http://127.0.0.1:${WEB_PORT}"
PTL="http://127.0.0.1:${PTL_PORT}"
PHONE="${SMOKE_OPERATOR_OWNER_PHONE:-09174070937}"
OTP="${SMOKE_OPERATOR_OTP:-1234}"
ADMIN_HOST="${STAGING_OPERATOR_ADMIN_HOST:-operator.admin.localhost}"
PORTAL_HOST="${STAGING_PORTAL_HOST:-operator.portal.localhost}"
TOUR_ID="${STAGING_OPERATOR_TOUR_ID:-00000000-0000-4000-8000-000000000210}"
GUEST_NAME="${P7_APPROVE_GUEST_NAME:-P7 Approve Guest}"
GUEST_EMAIL="${P7_APPROVE_GUEST_EMAIL:-p7-approve-guest-$(date +%s)@staging.test}"
PARTY_SIZE="${P7_APPROVE_PARTY_SIZE:-2}"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)

echo "== p7:staging-approve-booking-probe → ${VPS_USER}@${VPS_HOST} =="

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
GUEST_NAME="${GUEST_NAME}"
GUEST_EMAIL="${GUEST_EMAIL}"
PARTY_SIZE="${PARTY_SIZE}"

ADMIN_HDR=( -H "Host: \${ADMIN_HOST}" )
PORTAL_HDR=( -H "Host: \${PORTAL_HOST}" )
fail() { echo "P7_STAGING_APPROVE_BOOKING_PROBE_FAIL: \$1" >&2; exit 1; }

cd "\${DEPLOY_PATH}/apps/api"
set -a
# shellcheck source=/dev/null
source "\${ENV_DIR}/api.env"
set +a
NODE_ENV=development pnpm exec tsx scripts/seed-operator-smoke-identity-staging.ts >/tmp/p7-approve-seed.log 2>&1 \\
  || fail "seed-operator-smoke-identity-staging failed — see /tmp/p7-approve-seed.log"

reg=\$(curl -sf -X POST "\${PTL}/api/catalog/registrations" "\${PORTAL_HDR[@]}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"tourId\\":\\"\${TOUR_ID}\\",\\"email\\":\\"\${GUEST_EMAIL}\\",\\"fullName\\":\\"\${GUEST_NAME}\\",\\"partySize\\":\${PARTY_SIZE}}")
BOOKING_ID=\$(echo "\$reg" | python3 -c "
import json, sys
body = json.loads(sys.stdin.read())
assert body.get('ok') is True, body
bid = body.get('registrationId')
assert bid, body
print(bid)
")
echo "portal: pending booking id=\${BOOKING_ID}"

CID=\$(curl -sf -X POST "\${WEB}/api/auth/request-otp" "\${ADMIN_HDR[@]}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"phone\\":\\"\${PHONE}\\"}" \\
  | python3 -c "import json,sys; print(json.load(sys.stdin)['challenge_id'])")

TOKEN=\$(curl -sf -X POST "\${WEB}/api/auth/login-web-session" "\${ADMIN_HDR[@]}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"phone\\":\\"\${PHONE}\\",\\"otp\\":\\"\${OTP}\\",\\"challenge_id\\":\\"\${CID}\\"}" \\
  | python3 -c "import json,sys; print(json.load(sys.stdin)['session_token'])")

COOKIE=( -H "Cookie: session=\${TOKEN}" )

approve=\$(curl -sf -X POST "\${ADMIN_HDR[@]}" "\${COOKIE[@]}" \\
  "\${WEB}/api/bookings/\${BOOKING_ID}/approve")
echo "\$approve" | python3 -c "
import json, sys
body = json.loads(sys.stdin.read())
assert body.get('status') == 'approved', body
assert body.get('id'), body
assert body.get('approvedAt'), body
print('workspace: approve OK status=approved approvedAt=', body['approvedAt'])
"

bookings=\$(curl -sf "\${ADMIN_HDR[@]}" "\${COOKIE[@]}" \\
  "\${WEB}/api/bookings?tourId=\${TOUR_ID}&view=ops")
echo "\$bookings" | BOOKING_ID="\${BOOKING_ID}" python3 -c "
import json, os, sys
booking_id = os.environ['BOOKING_ID']
body = json.loads(sys.stdin.read())
items = body.get('items') or []
match = [row for row in items if row.get('id') == booking_id]
assert match, f'booking {booking_id} missing from list: {items!r}'
assert match[0].get('status') == 'approved', match[0]
print('api: booking list shows approved id=', match[0]['id'])
"

NODE_ENV=development pnpm exec tsx scripts/verify-booking-approve-outbox-staging.ts "\${BOOKING_ID}" \\
  || fail "outbox verification failed for \${BOOKING_ID}"

echo "P7_STAGING_APPROVE_BOOKING_PROBE_OK"
EOF

echo "P7_STAGING_APPROVE_BOOKING_PROBE_OK"
