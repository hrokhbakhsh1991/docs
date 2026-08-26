#!/usr/bin/env bash
# P7-2-N-008 — VS-06 operator runbook chain on staging (~20s)
# Maps first-customer-operator.md VS-06: portal pending → workspace → approve → outbox
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
GUEST_NAME="${P7_VS06_GUEST_NAME:-P7 VS-06 Runbook Guest}"
GUEST_EMAIL="${P7_VS06_GUEST_EMAIL:-p7-vs06-runbook-$(date +%s)@staging.test}"
PARTY_SIZE="${P7_VS06_PARTY_SIZE:-2}"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)

echo "== p7:staging-vs06-runbook-probe → ${VPS_USER}@${VPS_HOST} =="

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
fail() { echo "P7_STAGING_VS06_RUNBOOK_PROBE_FAIL: \$1" >&2; exit 1; }

cd "\${DEPLOY_PATH}/apps/api"
set -a
# shellcheck source=/dev/null
source "\${ENV_DIR}/api.env"
set +a
NODE_ENV=development pnpm exec tsx scripts/seed-operator-smoke-identity-staging.ts >/tmp/p7-vs06-seed.log 2>&1 \\
  || fail "seed-operator-smoke-identity-staging failed"

echo "runbook step 1: operator OTP login"
CID=\$(curl -sf -X POST "\${WEB}/api/auth/request-otp" "\${ADMIN_HDR[@]}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"phone\\":\\"\${PHONE}\\"}" \\
  | python3 -c "import json,sys; print(json.load(sys.stdin)['challenge_id'])")

TOKEN=\$(curl -sf -X POST "\${WEB}/api/auth/login-web-session" "\${ADMIN_HDR[@]}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"phone\\":\\"\${PHONE}\\",\\"otp\\":\\"\${OTP}\\",\\"challenge_id\\":\\"\${CID}\\"}" \\
  | python3 -c "import json,sys; print(json.load(sys.stdin)['session_token'])")

COOKIE=( -H "Cookie: session=\${TOKEN}" )

echo "runbook prerequisite: portal registration → pending booking"
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

echo "runbook step 2: tour workspace registrations shell"
ws_code=\$(curl -sS -o /tmp/p7-vs06-ws.html -w '%{http_code}' \\
  "\${ADMIN_HDR[@]}" "\${COOKIE[@]}" "\${WEB}/tours/\${TOUR_ID}/workspace")
[[ "\$ws_code" == "200" ]] || fail "workspace page HTTP \${ws_code}"
grep -q 'data-testid="operator-tour-workspace-registrations-panel"' /tmp/p7-vs06-ws.html \\
  || fail "workspace registrations panel missing"
grep -q "/tours/\${TOUR_ID}/register" /tmp/p7-vs06-ws.html \\
  || fail "workspace register link missing"

echo "runbook step 3: locate pending row (guest + party)"
pending=\$(curl -sf "\${ADMIN_HDR[@]}" "\${COOKIE[@]}" \\
  "\${WEB}/api/bookings?tourId=\${TOUR_ID}&view=ops&status=pending")
echo "\$pending" | BOOKING_ID="\${BOOKING_ID}" GUEST_NAME="\${GUEST_NAME}" PARTY_SIZE="\${PARTY_SIZE}" python3 -c "
import json, os, sys
booking_id = os.environ['BOOKING_ID']
guest = os.environ['GUEST_NAME']
party = int(os.environ['PARTY_SIZE'])
body = json.loads(sys.stdin.read())
items = body.get('items') or []
match = [row for row in items if row.get('id') == booking_id and row.get('status') == 'pending']
assert match, f'pending row missing: {items!r}'
assert match[0].get('guestLabel') == guest, match[0]
assert match[0].get('partySize') == party, match[0]
print('workspace: pending row guest=', guest, 'party=', party)
"

echo "runbook step 4: approve booking"
approve=\$(curl -sf -X POST "\${ADMIN_HDR[@]}" "\${COOKIE[@]}" \\
  "\${WEB}/api/bookings/\${BOOKING_ID}/approve")
echo "\$approve" | python3 -c "
import json, sys
body = json.loads(sys.stdin.read())
assert body.get('status') == 'approved', body
assert body.get('approvedAt'), body
print('operator: approve OK')
"

echo "runbook step 5: verify approved + outbox"
bookings=\$(curl -sf "\${ADMIN_HDR[@]}" "\${COOKIE[@]}" \\
  "\${WEB}/api/bookings?tourId=\${TOUR_ID}&view=ops")
echo "\$bookings" | BOOKING_ID="\${BOOKING_ID}" python3 -c "
import json, os, sys
booking_id = os.environ['BOOKING_ID']
body = json.loads(sys.stdin.read())
items = body.get('items') or []
match = [row for row in items if row.get('id') == booking_id]
assert match and match[0].get('status') == 'approved', match
print('api: booking status approved')
"

NODE_ENV=development pnpm exec tsx scripts/verify-booking-approve-outbox-staging.ts "\${BOOKING_ID}" \\
  || fail "outbox registration.approved missing"

echo "P7_STAGING_VS06_RUNBOOK_PROBE_OK"
EOF

echo "P7_STAGING_VS06_RUNBOOK_PROBE_OK"
