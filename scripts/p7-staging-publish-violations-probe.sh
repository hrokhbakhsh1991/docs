#!/usr/bin/env bash
# P7-1-N-005 — staging publish violations probe (~10s)
# Proves incomplete publish is rejected with CANONICAL_VALIDATION_FAILED on live API.
# UI uses the same validation path before createTourAction (client) — bundle check included.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VPS_HOST="${VPS_HOST:-89.45.89.206}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_PATH="${VPS_DEPLOY_PATH:-/opt/app-tour-staging}"
WEB_PORT="${STAGING_WEB_PORT:-23000}"
API_PORT="${STAGING_API_PORT:-23001}"
WEB="http://127.0.0.1:${WEB_PORT}"
API="http://127.0.0.1:${API_PORT}"
PHONE="${SMOKE_OPERATOR_PHONE:-${OPERATOR_OWNER_MOBILE:-+15550001001}}"
OTP="${SMOKE_OPERATOR_OTP:-1234}"
ADMIN_HOST="${STAGING_OPERATOR_ADMIN_HOST:-operator.admin.localhost}"
FIXTURE="${ROOT}/scripts/fixtures/p7-staging-publish-violation-body.json"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)

if [[ ! -f "$FIXTURE" ]]; then
  echo "P7_STAGING_PUBLISH_VIOLATIONS_PROBE_FAIL: missing fixture $FIXTURE" >&2
  exit 1
fi

echo "== p7:staging-publish-violations-probe → ${VPS_USER}@${VPS_HOST} =="

bash "${ROOT}/scripts/p7-staging-sync-platform-core.sh"

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" "mkdir -p ${DEPLOY_PATH}/scripts/fixtures"
rsync -az "$FIXTURE" "${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/scripts/fixtures/p7-staging-publish-violation-body.json"

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
WEB="${WEB}"
API="${API}"
PHONE="${PHONE}"
OTP="${OTP}"
ADMIN_HOST="${ADMIN_HOST}"
DEPLOY_PATH="${DEPLOY_PATH}"
BODY_FILE="\${DEPLOY_PATH}/scripts/fixtures/p7-staging-publish-violation-body.json"

HOST_HDR=( -H "Host: \${ADMIN_HOST}" )
fail() { echo "P7_STAGING_PUBLISH_VIOLATIONS_PROBE_FAIL: \$1" >&2; exit 1; }

[[ -f "\$BODY_FILE" ]] || fail "fixture missing on VPS: \$BODY_FILE"

CID=\$(curl -sf -X POST "\${WEB}/api/auth/request-otp" "\${HOST_HDR[@]}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"phone\\":\\"\${PHONE}\\"}" \\
  | python3 -c "import json,sys; print(json.load(sys.stdin)['challenge_id'])")

TOKEN=\$(curl -sf -X POST "\${WEB}/api/auth/login-web-session" "\${HOST_HDR[@]}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"phone\\":\\"\${PHONE}\\",\\"otp\\":\\"\${OTP}\\",\\"challenge_id\\":\\"\${CID}\\"}" \\
  | python3 -c "import json,sys; print(json.load(sys.stdin)['session_token'])")

RESP=\$(curl -sS -w "\\nHTTP:%{http_code}" -X POST "\${API}/tours" \\
  "\${HOST_HDR[@]}" -H "Authorization: Bearer \${TOKEN}" -H "Content-Type: application/json" -d @"\$BODY_FILE")
HTTP=\$(echo "\$RESP" | tail -1 | cut -d: -f2)
JSON=\$(echo "\$RESP" | sed '\$d')

echo "POST /tours incomplete publish → HTTP \${HTTP}"
[[ "\$HTTP" == "400" ]] || fail "expected HTTP 400 got \${HTTP} body=\${JSON}"

echo "\$JSON" | python3 -c "
import json, sys
body = json.loads(sys.stdin.read())
assert body.get('code') == 'VALIDATION_FAILURE', body
err = body.get('error') or ''
assert 'CANONICAL_VALIDATION_FAILED' in err, err
assert err.count('canonical path') >= 3, err
print('validation: CANONICAL_VALIDATION_FAILED with', err.count('canonical path'), 'paths')
"

grep -rq 'workspace-wizard-validation-summary' "\${DEPLOY_PATH}/apps/web/.next" \\
  || fail "validation summary UI not in web bundle"
echo "ui-bundle: workspace-wizard-validation-summary present"

echo "P7_STAGING_PUBLISH_VIOLATIONS_PROBE_OK"
EOF

echo "P7_STAGING_PUBLISH_VIOLATIONS_PROBE_OK"
