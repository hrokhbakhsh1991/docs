#!/usr/bin/env bash
# P7-2-N-007 — finance hub pending receipts link + queue on staging (~15s)
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
RECEIPT_ID="${STAGING_FINANCE_RECEIPT_ID:-00000000-0000-4000-8000-000000000402}"
MARKER="${P7_FINANCE_RECEIPT_MARKER:-P7 staging finance receipt}"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)

echo "== p7:staging-finance-hub-probe → ${VPS_USER}@${VPS_HOST} =="

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
DEPLOY_PATH="${DEPLOY_PATH}"
ENV_DIR="${ENV_DIR}"
WEB="${WEB}"
PHONE="${PHONE}"
OTP="${OTP}"
ADMIN_HOST="${ADMIN_HOST}"
RECEIPT_ID="${RECEIPT_ID}"
MARKER="${MARKER}"

ADMIN_HDR=( -H "Host: \${ADMIN_HOST}" )
fail() { echo "P7_STAGING_FINANCE_HUB_PROBE_FAIL: \$1" >&2; exit 1; }

cd "\${DEPLOY_PATH}/apps/api"
set -a
# shellcheck source=/dev/null
source "\${ENV_DIR}/api.env"
set +a
NODE_ENV=development pnpm exec tsx scripts/seed-operator-smoke-identity-staging.ts >/tmp/p7-fin-id.log 2>&1 \\
  || fail "seed-operator-smoke-identity-staging failed"
NODE_ENV=development pnpm exec tsx scripts/seed-operator-smoke-finance-receipt-staging.ts >/tmp/p7-fin-rcpt.log 2>&1 \\
  || fail "seed-operator-smoke-finance-receipt-staging failed"

CID=\$(curl -sf -X POST "\${WEB}/api/auth/request-otp" "\${ADMIN_HDR[@]}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"phone\\":\\"\${PHONE}\\"}" \\
  | python3 -c "import json,sys; print(json.load(sys.stdin)['challenge_id'])")

TOKEN=\$(curl -sf -X POST "\${WEB}/api/auth/login-web-session" "\${ADMIN_HDR[@]}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"phone\\":\\"\${PHONE}\\",\\"otp\\":\\"\${OTP}\\",\\"challenge_id\\":\\"\${CID}\\"}" \\
  | python3 -c "import json,sys; print(json.load(sys.stdin)['session_token'])")

COOKIE=( -H "Cookie: session=\${TOKEN}" )

summary=\$(curl -sf "\${ADMIN_HDR[@]}" "\${COOKIE[@]}" "\${WEB}/api/finance/reports/summary")
echo "\$summary" | python3 -c "
import json, sys
body = json.loads(sys.stdin.read())
count = body.get('pendingReceiptReviews')
assert isinstance(count, int) and count >= 1, body
print('finance: summary pendingReceiptReviews=', count)
"

pending=\$(curl -sf "\${ADMIN_HDR[@]}" "\${COOKIE[@]}" \\
  "\${WEB}/api/finance/receipts/pending?limit=50")
echo "\$pending" | RECEIPT_ID="\${RECEIPT_ID}" MARKER="\${MARKER}" python3 -c "
import json, os, sys
receipt_id = os.environ['RECEIPT_ID']
marker = os.environ['MARKER']
body = json.loads(sys.stdin.read())
items = body.get('items') or []
match = [row for row in items if row.get('id') == receipt_id and row.get('status') == 'Pending']
assert match, f'pending receipt missing: {items!r}'
note = match[0].get('note') or ''
assert marker in note, f'marker missing in note: {note!r}'
print('finance: pending queue receipt id=', receipt_id)
"

finance_html=\$(curl -sS "\${ADMIN_HDR[@]}" "\${COOKIE[@]}" "\${WEB}/finance?tab=receipts")
echo "\$finance_html" | grep -q 'data-testid="finance-command-center"' \\
  || fail "finance command center marker missing"
echo "\$finance_html" | grep -q '/finance?tab=receipts' \\
  || fail "finance receipts tab link missing"
echo "ui: finance hub + receipts tab link present"

echo "P7_STAGING_FINANCE_HUB_PROBE_OK"
EOF

echo "P7_STAGING_FINANCE_HUB_PROBE_OK"
