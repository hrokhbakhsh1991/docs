#!/usr/bin/env bash
# P7-1-N-007 — staging draft session persistence probe (~12s)
# Simulates mid-wizard save + reload: PATCH step 3 envelope, GET round-trip twice.
set -euo pipefail

VPS_HOST="${VPS_HOST:-89.45.89.206}"
VPS_USER="${VPS_USER:-root}"
WEB_PORT="${STAGING_WEB_PORT:-23000}"
WEB="http://127.0.0.1:${WEB_PORT}"
PHONE="${SMOKE_OPERATOR_PHONE:-${OPERATOR_OWNER_MOBILE:-+15550001001}}"
OTP="${SMOKE_OPERATOR_OTP:-1234}"
ADMIN_HOST="${STAGING_ADMIN_HOST:-denali.admin.localhost}"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)

echo "== p7:staging-draft-refresh-probe → ${VPS_USER}@${VPS_HOST} =="

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
WEB="${WEB}"
PHONE="${PHONE}"
OTP="${OTP}"
ADMIN_HOST="${ADMIN_HOST}"

HOST_HDR=( -H "Host: \${ADMIN_HOST}" )
DRAFT_PATH="/api/workspaces/ws-denali-dev/drafts/operator.wizard/denali-create"
fail() { echo "P7_STAGING_DRAFT_REFRESH_PROBE_FAIL: \$1" >&2; exit 1; }

CID=\$(curl -sf -X POST "\${WEB}/api/auth/request-otp" "\${HOST_HDR[@]}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"phone\\":\\"\${PHONE}\\"}" \\
  | python3 -c "import json,sys; print(json.load(sys.stdin)['challenge_id'])")

TOKEN=\$(curl -sf -X POST "\${WEB}/api/auth/login-web-session" "\${HOST_HDR[@]}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"phone\\":\\"\${PHONE}\\",\\"otp\\":\\"\${OTP}\\",\\"challenge_id\\":\\"\${CID}\\"}" \\
  | python3 -c "import json,sys; print(json.load(sys.stdin)['session_token'])")

COOKIE=( -H "Cookie: session=\${TOKEN}" )

SESSION_ID="p7-n007-\$(date +%s)"
TITLE="P7-N007-\${SESSION_ID}"
STEP_INDEX=2

GET0=\$(curl -sS -w "\\nHTTP:%{http_code}" "\${HOST_HDR[@]}" "\${COOKIE[@]}" "\${WEB}\${DRAFT_PATH}" || true)
HTTP0=\$(echo "\$GET0" | tail -1 | cut -d: -f2)
JSON0=\$(echo "\$GET0" | sed '\$d')
if [[ "\$HTTP0" == "404" ]]; then
  VERSION=0
elif [[ "\$HTTP0" == "200" ]]; then
  VERSION=\$(echo "\$JSON0" | python3 -c "import json,sys; print(json.load(sys.stdin).get('version',0))")
else
  fail "initial GET HTTP \${HTTP0}"
fi

PATCH_BODY=\$(python3 - <<PY
import json, time
envelope = {
  "form": {
    "data": {
      "title": "\${TITLE}",
      "publishStatus": "draft",
      "category": "mountain_day",
      "program": {"difficultyLevel": 6},
    }
  },
  "meta": {
    "currentStepIndex": \${STEP_INDEX},
    "wizardSessionId": "\${SESSION_ID}",
  },
}
print(json.dumps({
  "data": envelope,
  "version": \${VERSION},
  "schemaVersion": 1,
  "lastModified": int(time.time() * 1000),
}))
PY
)

PATCH=\$(curl -sS -w "\\nHTTP:%{http_code}" -X PATCH "\${HOST_HDR[@]}" "\${COOKIE[@]}" \\
  -H "Content-Type: application/json" \\
  -d "\$PATCH_BODY" \\
  "\${WEB}\${DRAFT_PATH}")
HTTP_PATCH=\$(echo "\$PATCH" | tail -1 | cut -d: -f2)
[[ "\$HTTP_PATCH" == "200" ]] || fail "PATCH HTTP \${HTTP_PATCH} body=\$(echo "\$PATCH" | sed '\$d' | head -c 200)"

assert_draft() {
  local label="\$1"
  local body="\$2"
  echo "\$body" | python3 -c "
import json, sys
label = sys.argv[1]
body = json.loads(sys.stdin.read())
data = body.get('data') or {}
meta = data.get('meta') or {}
form = (data.get('form') or {}).get('data') or {}
title = form.get('title') or ''
step = meta.get('currentStepIndex')
session = meta.get('wizardSessionId') or ''
expected_title = sys.argv[2]
expected_step = int(sys.argv[3])
expected_session = sys.argv[4]
assert title == expected_title, f'{label}: title={title!r}'
assert step == expected_step, f'{label}: step={step!r}'
assert session == expected_session, f'{label}: session={session!r}'
diff = (form.get('program') or {}).get('difficultyLevel')
assert diff == 6 or diff == '6', f'{label}: difficulty={diff!r}'
print(f'{label}: step={step} session={session[:20]} title ok')
" "\$label" "\${TITLE}" "\${STEP_INDEX}" "\${SESSION_ID}"
}

for pass in refresh-1 refresh-2; do
  RESP=\$(curl -sf "\${HOST_HDR[@]}" "\${COOKIE[@]}" "\${WEB}\${DRAFT_PATH}")
  assert_draft "\$pass" "\$RESP"
done

echo "P7_STAGING_DRAFT_REFRESH_PROBE_OK"
EOF

echo "P7_STAGING_DRAFT_REFRESH_PROBE_OK"
