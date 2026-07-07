#!/usr/bin/env bash
# P7-1-N-001 — automated staging wizard probe (~10s, no Playwright)
# Runs on VPS via SSH: OTP login → session → /tours/new HTTP check
set -euo pipefail

VPS_HOST="${VPS_HOST:-89.45.89.206}"
VPS_USER="${VPS_USER:-root}"
WEB_PORT="${STAGING_WEB_PORT:-23000}"
WEB="http://127.0.0.1:${WEB_PORT}"
PHONE="${SMOKE_OPERATOR_PHONE:-${OPERATOR_OWNER_MOBILE:-+15550001001}}"
OTP="${SMOKE_OPERATOR_OTP:-1234}"
# VPS bare-IP login falls back to tenant …003; use denali.admin.localhost so auth + wizard share tenant.
ADMIN_HOST="${STAGING_ADMIN_HOST:-denali.admin.localhost}"

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=15)
if [[ -n "${VPS_SSH_KEY:-}" ]]; then
  KEY_FILE="$(mktemp)"
  trap 'rm -f "$KEY_FILE"' EXIT
  printf '%s\n' "$VPS_SSH_KEY" >"$KEY_FILE"
  chmod 600 "$KEY_FILE"
  SSH_OPTS+=(-i "$KEY_FILE")
fi

echo "== p7:staging-wizard-probe → ${VPS_USER}@${VPS_HOST} =="

ssh "${SSH_OPTS[@]}" "${VPS_USER}@${VPS_HOST}" bash -s <<EOF
set -euo pipefail
WEB="${WEB}"
PHONE="${PHONE}"
OTP="${OTP}"
ADMIN_HOST="${ADMIN_HOST}"

HOST_HDR=( -H "Host: \${ADMIN_HOST}" )

fail() { echo "P7_STAGING_WIZARD_PROBE_FAIL: \$1" >&2; exit 1; }

CID=\$(curl -sf -X POST "\${WEB}/api/auth/request-otp" \\
  "\${HOST_HDR[@]}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"phone\\":\\"\${PHONE}\\"}" \\
  | python3 -c "import json,sys; print(json.load(sys.stdin)['challenge_id'])")

TOKEN=\$(curl -sf -X POST "\${WEB}/api/auth/login-web-session" \\
  "\${HOST_HDR[@]}" \\
  -H "Content-Type: application/json" \\
  -d "{\\"phone\\":\\"\${PHONE}\\",\\"otp\\":\\"\${OTP}\\",\\"challenge_id\\":\\"\${CID}\\"}" \\
  | python3 -c "import json,sys; print(json.load(sys.stdin)['session_token'])")

SESSION=\$(curl -sf "\${HOST_HDR[@]}" -H "Cookie: session=\${TOKEN}" "\${WEB}/api/auth/session")
echo "session: \${SESSION}" | head -c 200
echo

WIZ_CODE=\$(curl -sS -o /tmp/p7-wiz.html -w '%{http_code}' \\
  "\${HOST_HDR[@]}" \\
  -H "Cookie: session=\${TOKEN}" \\
  "\${WEB}/tours/new" || echo 000)

if [[ "\${WIZ_CODE}" == "200" ]] && grep -q 'data-workspace-wizard' /tmp/p7-wiz.html 2>/dev/null; then
  echo "wizard: HTTP 200 + data-workspace-wizard"
elif [[ "\${WIZ_CODE}" == "500" ]] || grep -q '__next_error__' /tmp/p7-wiz.html 2>/dev/null; then
  echo "wizard: HTTP \${WIZ_CODE} — server error (check journalctl app-tour-staging-web)"
  grep -oE 'getDenaliWizardRulesModuleSync|TypeError' /tmp/p7-wiz.html 2>/dev/null || true
  journalctl -u app-tour-staging-web -n 3 --no-pager 2>/dev/null | grep -E 'TypeError|Error' || true
  fail "wizard shell not loadable on staging (lite-deploy bundle mismatch likely)"
else
  echo "wizard: HTTP \${WIZ_CODE}"
  head -c 120 /tmp/p7-wiz.html 2>/dev/null || true
  echo
  fail "unexpected wizard response"
fi

echo "P7_STAGING_WIZARD_PROBE_OK"
EOF

echo "P7_STAGING_WIZARD_PROBE_OK"
