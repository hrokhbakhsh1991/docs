#!/usr/bin/env bash
# P7-1-N-004 — staging picker catalog probe (~8s)
set -euo pipefail

VPS_HOST="${VPS_HOST:-89.45.89.206}"
VPS_USER="${VPS_USER:-root}"
WEB_PORT="${STAGING_WEB_PORT:-23000}"
API_PORT="${STAGING_API_PORT:-23001}"
WEB="http://127.0.0.1:${WEB_PORT}"
API="http://127.0.0.1:${API_PORT}"
PHONE="${SMOKE_OPERATOR_PHONE:-${OPERATOR_OWNER_MOBILE:-+15550001001}}"
OTP="${SMOKE_OPERATOR_OTP:-1234}"
ADMIN_HOST="${STAGING_ADMIN_HOST:-denali.admin.localhost}"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)

echo "== p7:staging-picker-probe → ${VPS_USER}@${VPS_HOST} =="

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
WEB="${WEB}"
API="${API}"
PHONE="${PHONE}"
OTP="${OTP}"
ADMIN_HOST="${ADMIN_HOST}"

HOST_HDR=( -H "Host: \${ADMIN_HOST}" )
fail() { echo "P7_STAGING_PICKER_PROBE_FAIL: \$1" >&2; exit 1; }

CID=\$(curl -sf -X POST "\${WEB}/api/auth/request-otp" "\${HOST_HDR[@]}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"phone\\":\\"\${PHONE}\\"}" \\
  | python3 -c "import json,sys; print(json.load(sys.stdin)['challenge_id'])")

TOKEN=\$(curl -sf -X POST "\${WEB}/api/auth/login-web-session" "\${HOST_HDR[@]}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"phone\\":\\"\${PHONE}\\",\\"otp\\":\\"\${OTP}\\",\\"challenge_id\\":\\"\${CID}\\"}" \\
  | python3 -c "import json,sys; print(json.load(sys.stdin)['session_token'])")

loc=\$(curl -sf "\${HOST_HDR[@]}" -H "Authorization: Bearer \${TOKEN}" "\${API}/settings/resources/locations")
dest=\$(echo "\$loc" | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('destinations',[])))")
equip=\$(curl -sf "\${HOST_HDR[@]}" -H "Authorization: Bearer \${TOKEN}" "\${API}/settings/resources/equipment" \\
  | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('items',[])))")
themes=\$(curl -sf "\${HOST_HDR[@]}" -H "Authorization: Bearer \${TOKEN}" "\${API}/settings/resources/tour_themes" \\
  | python3 -c "import json,sys; print(len(json.load(sys.stdin).get('items',[])))")

echo "destinations=\${dest} equipment=\${equip} tour_themes=\${themes}"

[[ "\$dest" -ge 3 ]] || fail "destinations < 3 (run seed-denali-dev-catalog-staging.ts)"
[[ "\$equip" -ge 1 ]] || fail "equipment empty"
[[ "\$themes" -ge 1 ]] || fail "tour_themes empty"

curl -sS "\${HOST_HDR[@]}" -H "Cookie: session=\${TOKEN}" "\${WEB}/tours/new" -o /tmp/p7-pickers.html
grep -q 'data-workspace-wizard' /tmp/p7-pickers.html || fail "wizard shell missing"
grep -q 'توچال' /tmp/p7-pickers.html || fail "destination label missing in wizard HTML"

echo "P7_STAGING_PICKER_PROBE_OK"
EOF

echo "P7_STAGING_PICKER_PROBE_OK"
