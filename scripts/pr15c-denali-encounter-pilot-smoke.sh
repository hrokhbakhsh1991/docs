#!/usr/bin/env bash
# PR15-C — Denali Encounter pilot smoke (observation only).
# Requires API already running with:
#   FINANCE_CASE_ENCOUNTER_MODE=pilot
#   FINANCE_CASE_ENCOUNTER_PILOT_TENANTS=<pilot-tenant>
#   FINANCE_CASE_SHADOW_ENABLED=false
set -euo pipefail
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

ADMIN_HOST="${ADMIN_HOST:-denali.admin.localhost}"
WEB="${WEB:-http://127.0.0.1:3000}"
API="${API:-http://127.0.0.1:3001}"
PHONE="${SMOKE_OPERATOR_PHONE:-09174070937}"
OTP="${SMOKE_OPERATOR_OTP:-1234}"
PILOT_TENANT="${FINANCE_CASE_ENCOUNTER_PILOT_TENANTS:-00000000-0000-4000-8000-000000000003}"
JAR="${SMOKE_COOKIE_JAR:-/tmp/pr15c-pilot-smoke.jar}"
RESULTS="${SMOKE_RESULTS:-/tmp/pr15c-pilot-smoke.json}"

echo '{}' >"$RESULTS"
record() {
  python3 - "$RESULTS" "$1" "$2" "$3" <<'PY'
import json, sys
path, key, status, detail = sys.argv[1:5]
data = json.loads(open(path).read())
data[key] = {"status": status, "detail": detail[:2000]}
open(path, "w").write(json.dumps(data, indent=2))
print(f"[{status}] {key}: {detail[:220]}")
PY
}
fail() { echo "PR15C_PILOT_SMOKE_FAIL: $*" >&2; exit 1; }

echo "== PR15-C pilot smoke Host=$ADMIN_HOST pilot=$PILOT_TENANT =="
curl -sS --max-time 5 "$API/health" | python3 -c 'import json,sys; assert json.load(sys.stdin).get("status")=="ok"' \
  || fail "API health"

rm -f "$JAR"
REQ="$(curl -sS -c "$JAR" -b "$JAR" --max-time 30 -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\"}" "$WEB/api/auth/request-otp")"
CH="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["challenge_id"])' <<<"$REQ")"
curl -sS -c "$JAR" -b "$JAR" --max-time 30 -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"otp\":\"$OTP\",\"challenge_id\":\"$CH\"}" \
  -o /tmp/pr15c-login.json "$WEB/api/auth/login-web-session" >/dev/null
TOKEN="$(awk '$6=="atour_op_session"{print $7}' "$JAR")"
[[ -n "$TOKEN" ]] || fail "missing session"

curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" \
  "$WEB/api/finance/receipts/pending?limit=5" -o /tmp/pr15c-pending.json
REG="$(python3 -c 'import json; items=json.load(open("/tmp/pr15c-pending.json")).get("items") or []; print(items[0]["registrationId"] if items else "")')"
[[ -n "$REG" ]] || fail "no pending receipt registration for Encounter probe"

META1="$(curl -sS -o /tmp/pr15c-e1.json -w '%{http_code}|%{time_total}' --max-time 60 \
  -H "Host: $ADMIN_HOST" -H "Authorization: Bearer $TOKEN" \
  "$API/finance/case/encounters/$REG")"
META2="$(curl -sS -o /tmp/pr15c-e2.json -w '%{http_code}|%{time_total}' --max-time 60 \
  -H "Host: $ADMIN_HOST" -H "Authorization: Bearer $TOKEN" \
  "$API/finance/case/encounters/$REG")"
CODE1="${META1%%|*}"
[[ "$CODE1" == "200" ]] || fail "Encounter HTTP $CODE1 $(cat /tmp/pr15c-e1.json)"

python3 - <<'PY' || fail "Encounter contract failed"
import json, re
from pathlib import Path
b1 = json.loads(Path("/tmp/pr15c-e1.json").read_text())
b2 = json.loads(Path("/tmp/pr15c-e2.json").read_text())
raw = Path("/tmp/pr15c-e1.json").read_text()
for k in ("encounter", "executionId", "surfaceState", "commandCapability"):
    assert k in b1, k
assert b1["executionId"] != b2["executionId"]
assert not re.search(r"CaseOutput|FactSnapshot|\"facts\"|pi_[A-Za-z0-9]|webhook", raw, re.I)
print("ok", b1["surfaceState"], b1["encounter"].get("reading"), b1["executionId"], "->", b2["executionId"])
PY
record encounter_ok PASS "reg=$REG $META1"

# Isolation decision (same Host code; no second tenant login required)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/api"
node --import tsx - <<NODE
import { resolveEncounterProductionDecision } from "./src/workspace-finance/case/encounter/encounter-production-decision.ts";
import { loadFinanceCaseEncounterHttp } from "./src/workspace-finance/case/encounter/load-finance-case-encounter-http.ts";
const env = {
  FINANCE_CASE_ENCOUNTER_MODE: "pilot",
  FINANCE_CASE_ENCOUNTER_PILOT_TENANTS: process.env.FINANCE_CASE_ENCOUNTER_PILOT_TENANTS || "$PILOT_TENANT",
  FINANCE_CASE_SHADOW_ENABLED: "false",
};
const other = "00000000-0000-4000-8000-000000000014";
let executed = 0;
const denied = await loadFinanceCaseEncounterHttp({
  auth: { tenantId: other, userId: "u", role: "owner", status: "ACTIVE", workspaceId: "ws" },
  registrationId: "$REG",
  counterpartyId: "",
  deps: {},
  env,
  authorization: { assertOperatorAccess() {} },
  warmFinanceService: async () => {},
  loadPresentation: async () => { executed += 1; return { encounter: {}, executionId: "x" }; },
});
if (executed !== 0 || denied.status === 200) process.exit(1);
const d = resolveEncounterProductionDecision({ tenantId: other, env });
if (d.run) process.exit(1);
console.log("non_pilot", denied.status, denied.status !== 200 ? denied.error : null, d.reason);
NODE
record non_pilot_isolation PASS "tenant_not_allowed / zero Case execution"

echo "PR15C_PILOT_SMOKE_OK"
cat "$RESULTS"
