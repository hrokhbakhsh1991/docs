#!/usr/bin/env bash
# P7-2-N-004 — waitlisted row → operator promote (approve) on staging (~15s)
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
WAITLIST_BOOKING_ID="${STAGING_WAITLIST_BOOKING_ID:-00000000-0000-4000-8000-000000000312}"
GUEST_LABEL="${P7_WAITLIST_GUEST_LABEL:-Jamal Hosseini}"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)

echo "== p7:staging-waitlist-promote-probe → ${VPS_USER}@${VPS_HOST} =="

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
DEPLOY_PATH="${DEPLOY_PATH}"
ENV_DIR="${ENV_DIR}"
WEB="${WEB}"
PHONE="${PHONE}"
OTP="${OTP}"
ADMIN_HOST="${ADMIN_HOST}"
TOUR_ID="${TOUR_ID}"
WAITLIST_BOOKING_ID="${WAITLIST_BOOKING_ID}"
GUEST_LABEL="${GUEST_LABEL}"

ADMIN_HDR=( -H "Host: \${ADMIN_HOST}" )
fail() { echo "P7_STAGING_WAITLIST_PROMOTE_PROBE_FAIL: \$1" >&2; exit 1; }

cd "\${DEPLOY_PATH}/apps/api"
set -a
# shellcheck source=/dev/null
source "\${ENV_DIR}/api.env"
set +a
NODE_ENV=development pnpm exec tsx scripts/seed-operator-smoke-identity-staging.ts >/tmp/p7-wl-seed-id.log 2>&1 \\
  || fail "seed-operator-smoke-identity-staging failed"
NODE_ENV=development pnpm exec tsx scripts/seed-operator-smoke-waitlist-staging.ts >/tmp/p7-wl-seed-booking.log 2>&1 \\
  || fail "seed-operator-smoke-waitlist-staging failed"

CID=\$(curl -sf -X POST "\${WEB}/api/auth/request-otp" "\${ADMIN_HDR[@]}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"phone\\":\\"\${PHONE}\\"}" \\
  | python3 -c "import json,sys; print(json.load(sys.stdin)['challenge_id'])")

TOKEN=\$(curl -sf -X POST "\${WEB}/api/auth/login-web-session" "\${ADMIN_HDR[@]}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"phone\\":\\"\${PHONE}\\",\\"otp\\":\\"\${OTP}\\",\\"challenge_id\\":\\"\${CID}\\"}" \\
  | python3 -c "import json,sys; print(json.load(sys.stdin)['session_token'])")

COOKIE=( -H "Cookie: session=\${TOKEN}" )

waitlist=\$(curl -sf "\${ADMIN_HDR[@]}" "\${COOKIE[@]}" \\
  "\${WEB}/api/bookings?status=waitlisted&tourId=\${TOUR_ID}&view=ops")
echo "\$waitlist" | WAITLIST_BOOKING_ID="\${WAITLIST_BOOKING_ID}" GUEST_LABEL="\${GUEST_LABEL}" python3 -c "
import json, os, sys
booking_id = os.environ['WAITLIST_BOOKING_ID']
guest = os.environ['GUEST_LABEL']
body = json.loads(sys.stdin.read())
items = body.get('items') or []
match = [row for row in items if row.get('id') == booking_id and row.get('status') == 'waitlisted']
assert match, f'waitlisted row missing: {items!r}'
assert match[0].get('guestLabel') == guest, match[0]
print('workspace: waitlist row visible id=', booking_id, 'guest=', guest)
"

approve=\$(curl -sf -X POST "\${ADMIN_HDR[@]}" "\${COOKIE[@]}" \\
  "\${WEB}/api/bookings/\${WAITLIST_BOOKING_ID}/approve")
echo "\$approve" | python3 -c "
import json, sys
body = json.loads(sys.stdin.read())
assert body.get('status') == 'approved', body
assert body.get('approvedAt'), body
print('workspace: waitlist promote OK status=approved')
"

waitlist_after=\$(curl -sf "\${ADMIN_HDR[@]}" "\${COOKIE[@]}" \\
  "\${WEB}/api/bookings?status=waitlisted&tourId=\${TOUR_ID}&view=ops")
echo "\$waitlist_after" | WAITLIST_BOOKING_ID="\${WAITLIST_BOOKING_ID}" python3 -c "
import json, os, sys
booking_id = os.environ['WAITLIST_BOOKING_ID']
body = json.loads(sys.stdin.read())
items = body.get('items') or []
still = [row for row in items if row.get('id') == booking_id]
assert not still, f'booking still waitlisted after promote: {still!r}'
print('api: waitlist cleared for promoted booking')
"

NODE_ENV=development pnpm exec tsx scripts/verify-booking-approve-outbox-staging.ts "\${WAITLIST_BOOKING_ID}" \\
  || fail "outbox verification failed"

echo "P7_STAGING_WAITLIST_PROMOTE_PROBE_OK"
EOF

echo "P7_STAGING_WAITLIST_PROMOTE_PROBE_OK"
