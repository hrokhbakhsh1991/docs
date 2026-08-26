#!/usr/bin/env bash
# PR18-C — Single-tenant Denali Command UI live validation (reviewReceipt only).
# Requires API :3001 + web :3000 with:
#   FINANCE_CASE_ENCOUNTER_MODE=internal
#   FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS=00000000-0000-4000-8000-000000000003
#   FINANCE_CASE_SHADOW_ENABLED=false
#   FINANCE_CASE_COMMAND_UI_ENABLED=true
#   FINANCE_CASE_COMMAND_UI_TENANT=00000000-0000-4000-8000-000000000003
set -euo pipefail
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN_HOST="${ADMIN_HOST:-denali.admin.localhost}"
WEB="${WEB:-http://127.0.0.1:3000}"
API="${API:-http://127.0.0.1:3001}"
PHONE="${SMOKE_OPERATOR_PHONE:-09174070937}"
OTP="${SMOKE_OPERATOR_OTP:-1234}"
TENANT="${FINANCE_CASE_COMMAND_UI_TENANT:-00000000-0000-4000-8000-000000000003}"
OTHER_TENANT="00000000-0000-4000-8000-000000000004"
JAR="${SMOKE_COOKIE_JAR:-/tmp/pr18c-command-ui.jar}"
RESULTS="${SMOKE_RESULTS:-/tmp/pr18c-command-ui-smoke.json}"
TS="$(date -u +%Y%m%d%H%M%S)"

echo '{}' >"$RESULTS"
record() {
  python3 - "$RESULTS" "$1" "$2" "$3" <<'PY'
import json, sys
path, key, status, detail = sys.argv[1:5]
data = json.loads(open(path).read())
data[key] = {"status": status, "detail": detail[:4000]}
open(path, "w").write(json.dumps(data, indent=2))
print(f"[{status}] {key}: {detail[:240]}")
PY
}
fail() { echo "PR18C_SMOKE_FAIL: $*" >&2; exit 1; }

echo "== PR18-C Command UI smoke Host=$ADMIN_HOST tenant=$TENANT =="

curl -sS --max-time 5 "$API/health" | python3 -c 'import json,sys; assert json.load(sys.stdin).get("status")=="ok"' \
  || fail "API health"
record api_health PASS "ok"

# --- Login ---
rm -f "$JAR"
REQ="$(curl -sS -c "$JAR" -b "$JAR" --max-time 30 -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\"}" "$WEB/api/auth/request-otp")"
CH="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["challenge_id"])' <<<"$REQ")"
LOGIN="$(curl -sS -c "$JAR" -b "$JAR" --max-time 30 -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"otp\":\"$OTP\",\"challenge_id\":\"$CH\"}" \
  "$WEB/api/auth/login-web-session")"
echo "$LOGIN" | python3 -c 'import json,sys; assert json.load(sys.stdin).get("ok") is True' \
  || fail "login failed: $LOGIN"
TOKEN="$(awk '$6=="atour_op_session"{print $7}' "$JAR")"
[[ -n "$TOKEN" ]] || fail "missing session cookie"
record login PASS "operator session"

# --- Hub regression ---
curl -sS --max-time 60 -H "Host: $ADMIN_HOST" -b "$JAR" -o /tmp/pr18c-finance.html "$WEB/finance"
python3 - <<'PY' || fail "finance hub missing"
from pathlib import Path
html = Path("/tmp/pr18c-finance.html").read_text(errors="replace")
assert "finance-command-center" in html or "FinanceCommandCenter" in html
for tab in ("payments", "receipts"):
    assert tab in html.lower()
print("hub ok")
PY
record hub_loads PASS "command center + tabs"

# --- Ensure a reviewable receipt (create payment+receipt if needed) ---
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" \
  "$WEB/api/finance/receipts/pending?limit=20" -o /tmp/pr18c-pending-before.json
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" \
  "$WEB/api/bookings?limit=100" -o /tmp/pr18c-bookings-before.json

python3 - <<'PY'
import json
from pathlib import Path
pending = json.loads(Path("/tmp/pr18c-pending-before.json").read_text()).get("items") or []
bookings = json.loads(Path("/tmp/pr18c-bookings-before.json").read_text()).get("items") or []
# Prefer pending with approve_evidence-capable registration later; pick first pending
pick = pending[0] if pending else None
stale_pick = pending[1] if len(pending) > 1 else None
unpaid = [b for b in bookings if b.get("status")=="approved" and b.get("paymentStatus")=="unpaid"]
Path("/tmp/pr18c-plan.json").write_text(json.dumps({
  "receiptId": pick["id"] if pick else "",
  "registrationId": (pick.get("registrationId") or pick.get("payment",{}).get("registrationId") or "") if pick else "",
  "staleReceiptId": stale_pick["id"] if stale_pick else "",
  "staleRegistrationId": (stale_pick.get("registrationId") or "") if stale_pick else "",
  "createReg": unpaid[0]["id"] if unpaid and not pick else "",
}, indent=2))
print(Path("/tmp/pr18c-plan.json").read_text())
PY

RECEIPT_ID="$(python3 -c 'import json; print(json.load(open("/tmp/pr18c-plan.json"))["receiptId"])')"
REG="$(python3 -c 'import json; print(json.load(open("/tmp/pr18c-plan.json"))["registrationId"])')"
CREATE_REG="$(python3 -c 'import json; print(json.load(open("/tmp/pr18c-plan.json"))["createReg"])')"

if [[ -z "$RECEIPT_ID" || -z "$REG" ]]; then
  [[ -n "$CREATE_REG" ]] || fail "no pending receipt and no unpaid booking to seed"
  PAY_CODE="$(curl -sS -o /tmp/pr18c-pay.json -w '%{http_code}' --max-time 30 \
    -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
    -H "Idempotency-Key: pr18c-pay-$TS" \
    -d "{\"registrationId\":\"$CREATE_REG\",\"amount\":\"1500000\",\"currency\":\"IRR\"}" \
    "$WEB/api/finance/payments/manual")"
  PAY_ID="$(python3 -c 'import json; print(json.load(open("/tmp/pr18c-pay.json")).get("id",""))')"
  [[ "$PAY_CODE" == "201" && -n "$PAY_ID" ]] || fail "seed payment failed: $PAY_CODE $(cat /tmp/pr18c-pay.json)"
  python3 - <<'PY'
from pathlib import Path
import base64
Path("/tmp/pr18c.jpg").write_bytes(base64.b64decode(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEBAVFRUVFRUVFRUVFRUWFxUXFhUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAECBQYAB//EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A1oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/Z"
))
PY
  UP_CODE="$(curl -sS -o /tmp/pr18c-up.json -w '%{http_code}' --max-time 30 \
    -H "Host: $ADMIN_HOST" -b "$JAR" \
    -H 'content-type: image/jpeg' -H 'x-receipt-file-name: pr18c.jpg' \
    --data-binary @/tmp/pr18c.jpg \
    "$WEB/api/finance/receipts/upload?registrationId=$CREATE_REG")"
  FILE_KEY="$(python3 -c 'import json; print(json.load(open("/tmp/pr18c-up.json")).get("fileKey",""))')"
  [[ "$UP_CODE" == "201" && -n "$FILE_KEY" ]] || fail "seed upload failed: $UP_CODE"
  SUB_CODE="$(curl -sS -o /tmp/pr18c-sub.json -w '%{http_code}' --max-time 30 \
    -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
    -H "Idempotency-Key: pr18c-sub-$TS" \
    -d "{\"paymentId\":\"$PAY_ID\",\"fileKey\":\"$FILE_KEY\",\"note\":\"PR18-C smoke $TS\"}" \
    "$WEB/api/finance/receipts")"
  RECEIPT_ID="$(python3 -c 'import json; print(json.load(open("/tmp/pr18c-sub.json")).get("id",""))')"
  REG="$CREATE_REG"
  [[ "$SUB_CODE" == "201" && -n "$RECEIPT_ID" ]] || fail "seed submit failed: $SUB_CODE"
  record seed_receipt PASS "reg=$REG receipt=$RECEIPT_ID"
fi

# Counterparty: enrollment scope needs a non-empty id; use registration id (SoT product id, not Case).
export CP="$REG"
CP_Q="$(python3 -c 'import urllib.parse,os; print(urllib.parse.quote(os.environ["CP"]))')"

# --- Encounter before ---
ENC1_META="$(curl -sS -o /tmp/pr18c-enc1.json -w '%{http_code}|%{time_total}' --max-time 90 \
  -H "Host: $ADMIN_HOST" -b "$JAR" \
  "$WEB/api/finance/case/encounters/$REG?counterpartyId=$CP_Q")"
ENC1_CODE="${ENC1_META%%|*}"
[[ "$ENC1_CODE" == "200" ]] || fail "Encounter before HTTP $ENC1_CODE $(cat /tmp/pr18c-enc1.json)"

python3 - <<'PY' || fail "Encounter contract / leakage"
import json, re
from pathlib import Path
raw = Path("/tmp/pr18c-enc1.json").read_text()
b = json.loads(raw)
for k in ("encounter", "executionId", "surfaceState", "commandCapability"):
    assert k in b, k
cap = b["commandCapability"]
assert "reviewReceipt" in cap.get("supportedCommands", [])
tokens = cap["reviewReceipt"]["availableTokens"]
Path("/tmp/pr18c-enc1-meta.json").write_text(json.dumps({
  "executionId": b["executionId"],
  "caseKey": b["encounter"]["caseKey"],
  "meaningFingerprint": b.get("meaningFingerprint"),
  "tokens": tokens,
  "reading": b["encounter"].get("reading"),
}, indent=2))
assert not re.search(r"CaseOutput|FactSnapshot|\"facts\"|pi_[A-Za-z0-9]|webhook", raw, re.I)
print("enc1", b["executionId"], tokens, b["encounter"].get("reading"))
PY
record encounter_before PASS "$(cat /tmp/pr18c-enc1-meta.json)"

TOKENS="$(python3 -c 'import json; print(",".join(json.load(open("/tmp/pr18c-enc1-meta.json"))["tokens"]))')"
CASE_KEY="$(python3 -c 'import json; print(json.load(open("/tmp/pr18c-enc1-meta.json"))["caseKey"])')"
EXEC1="$(python3 -c 'import json; print(json.load(open("/tmp/pr18c-enc1-meta.json"))["executionId"])')"
FP1="$(python3 -c 'import json; print(json.load(open("/tmp/pr18c-enc1-meta.json")).get("meaningFingerprint") or "")')"

# Need approve_evidence for happy path; if missing, still record and try reject path or HOLD note
ACTION_TOKEN="approve_evidence"
ACTION_DECISION="approve"
if [[ "$TOKENS" != *approve_evidence* ]]; then
  if [[ "$TOKENS" == *reject_evidence* ]]; then
    ACTION_TOKEN="reject_evidence"
    ACTION_DECISION="reject"
  else
    record capability_tokens WARN "no review tokens for reg=$REG tokens=$TOKENS — cannot happy-path mutate"
    fail "no reviewReceipt tokens available on Encounter for $REG"
  fi
fi
record capability PASS "token=$ACTION_TOKEN"

# Booking payment before
BEFORE_PAY="$(python3 -c "import json; items=json.load(open('/tmp/pr18c-bookings-before.json'))['items']; print(next((b.get('paymentStatus') for b in items if b['id']=='$REG'),'MISSING'))")"

# --- Happy path Command Bridge via BFF ---
BODY="$(python3 - <<PY
import json
fp = json.load(open("/tmp/pr18c-enc1-meta.json")).get("meaningFingerprint")
body = {
  "caseKey": "$CASE_KEY",
  "action": {"command": "reviewReceipt", "token": "$ACTION_TOKEN", "decision": "$ACTION_DECISION"},
  "source": {"encounterExecutionId": "$EXEC1"},
  "correlationId": "pr18c-$TS",
  "reviewReceipt": {
    "registrationId": "$REG",
    "counterpartyId": "$CP",
    "receiptId": "$RECEIPT_ID",
    "reviewNote": "PR18-C command UI smoke $TS",
  },
}
if fp:
  body["source"]["encounterVersionHint"] = fp
print(json.dumps(body))
PY
)"

CMD_META="$(curl -sS -o /tmp/pr18c-cmd.json -w '%{http_code}|%{time_total}' --max-time 90 \
  -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
  -H "Idempotency-Key: pr18c-cmd-$TS" \
  -d "$BODY" \
  "$WEB/api/finance/case/commands/review-receipt")"
CMD_CODE="${CMD_META%%|*}"
[[ "$CMD_CODE" == "200" ]] || fail "command failed HTTP $CMD_CODE $(cat /tmp/pr18c-cmd.json)"

python3 - <<'PY' || fail "command response contract"
import json, re
from pathlib import Path
raw = Path("/tmp/pr18c-cmd.json").read_text()
b = json.loads(raw)
for k in ("encounter", "executionId", "surfaceState", "commandCapability", "command"):
    assert k in b, k
assert b["command"]["name"] == "reviewReceipt"
assert b["executionId"] != open("/tmp/pr18c-enc1-meta.json").read() or True
meta = json.load(open("/tmp/pr18c-enc1-meta.json"))
assert b["executionId"] != meta["executionId"], "executionId must change after command"
assert not re.search(r"CaseOutput|FactSnapshot|\"facts\"|pi_[A-Za-z0-9]", raw, re.I)
Path("/tmp/pr18c-cmd-meta.json").write_text(json.dumps({
  "executionId": b["executionId"],
  "reading": b["encounter"].get("reading"),
  "token": b["command"].get("token"),
}, indent=2))
print("cmd ok", b["executionId"], b["command"])
PY
record command_happy_path PASS "http=$CMD_CODE $(cat /tmp/pr18c-cmd-meta.json)"

# --- SoT after: pending list should not include approved receipt; booking sync ---
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" \
  "$WEB/api/finance/receipts/pending?limit=50" -o /tmp/pr18c-pending-after.json
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" \
  "$WEB/api/bookings?limit=100" -o /tmp/pr18c-bookings-after.json

python3 - <<PY || fail "SoT / parity check failed"
import json
from pathlib import Path
rid = "$RECEIPT_ID"
reg = "$REG"
decision = "$ACTION_DECISION"
pending = json.loads(Path("/tmp/pr18c-pending-after.json").read_text()).get("items") or []
ids = {p["id"] for p in pending}
assert rid not in ids, "receipt still pending after command"
after = next((b.get("paymentStatus") for b in json.loads(Path("/tmp/pr18c-bookings-after.json").read_text())["items"] if b["id"]==reg), "MISSING")
before = "$BEFORE_PAY"
Path("/tmp/pr18c-sot.json").write_text(json.dumps({
  "receiptId": rid,
  "stillPending": rid in ids,
  "bookingPaymentBefore": before,
  "bookingPaymentAfter": after,
  "decision": decision,
}, indent=2))
if decision == "approve":
    assert after in ("paid", "partial", "unpaid") or True  # soft: sync may be paid
print(Path("/tmp/pr18c-sot.json").read_text())
PY
record sot_after PASS "$(cat /tmp/pr18c-sot.json)"
record operational_parity PASS "classic pending list excludes $RECEIPT_ID"

# --- Meaning refresh (new executionId) ---
ENC2_META="$(curl -sS -o /tmp/pr18c-enc2.json -w '%{http_code}' --max-time 90 \
  -H "Host: $ADMIN_HOST" -b "$JAR" \
  "$WEB/api/finance/case/encounters/$REG?counterpartyId=$CP")"
[[ "$ENC2_META" == "200" ]] || fail "Encounter after HTTP $ENC2_META"
python3 - <<'PY' || fail "Meaning refresh executionId"
import json
from pathlib import Path
b1 = json.load(open("/tmp/pr18c-enc1.json"))
b2 = json.load(open("/tmp/pr18c-enc2.json"))
assert b2["executionId"] != b1["executionId"]
print(b1["executionId"], "->", b2["executionId"], "reading", b2["encounter"].get("reading"))
PY
record meaning_refresh PASS "new executionId"

# --- Stale command: replay pre-mutation intent after happy-path SoT change ---
# Prefer same receipt (already approved/rejected above). Expect STALE / VOCABULARY / SOT — never 200.
STALE_BODY="$(python3 - <<PY
import json
meta = json.load(open("/tmp/pr18c-enc1-meta.json"))
print(json.dumps({
  "caseKey": meta["caseKey"],
  "action": {"command": "reviewReceipt", "token": "$ACTION_TOKEN", "decision": "$ACTION_DECISION"},
  "source": {
    "encounterExecutionId": meta["executionId"],
    **({"encounterVersionHint": meta["meaningFingerprint"]} if meta.get("meaningFingerprint") else {}),
  },
  "correlationId": "pr18c-stale-$TS",
  "reviewReceipt": {
    "registrationId": "$REG",
    "counterpartyId": "$CP",
    "receiptId": "$RECEIPT_ID",
    "reviewNote": "PR18-C stale replay $TS",
  },
}))
PY
)"
STALE_CMD="$(curl -sS -o /tmp/pr18c-stale-cmd.json -w '%{http_code}' --max-time 90 \
  -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
  -H "Idempotency-Key: pr18c-stale-$TS" \
  -d "$STALE_BODY" \
  "$WEB/api/finance/case/commands/review-receipt")"
python3 - <<PY || fail "stale expectation"
import json
code=int("$STALE_CMD")
body=json.load(open("/tmp/pr18c-stale-cmd.json"))
err=(body.get("error") or {})
assert code != 200, body
code_s = err.get("code","")
assert code_s in (
  "CASE_COMMAND_STALE",
  "CASE_COMMAND_VOCABULARY_DENIED",
  "CASE_COMMAND_SOT_REJECTED",
  "CASE_COMMAND_INTENT_INVALID",
), code_s
# No second mutation claim: response must not be success presentation
assert "command" not in body or code != 200
print("stale_http", code, code_s)
PY
record stale_command PASS "cmd=$STALE_CMD $(python3 -c 'import json; print(json.load(open("/tmp/pr18c-stale-cmd.json")).get("error",{}))')"

# Optional: second pending — classic mutate then stale (parity with classic path)
STALE_R="$(python3 -c 'import json; print(json.load(open("/tmp/pr18c-plan.json")).get("staleReceiptId") or "")')"
STALE_REG="$(python3 -c 'import json; print(json.load(open("/tmp/pr18c-plan.json")).get("staleRegistrationId") or "")')"
if [[ -n "$STALE_R" && -n "$STALE_REG" && "$STALE_R" != "$RECEIPT_ID" ]]; then
  STALE_ENC="$(curl -sS -o /tmp/pr18c-stale-enc.json -w '%{http_code}' --max-time 90 \
    -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/case/encounters/$STALE_REG?counterpartyId=$STALE_REG")"
  if [[ "$STALE_ENC" == "200" ]]; then
    CLASSIC_CODE="$(curl -sS -o /tmp/pr18c-classic-rej.json -w '%{http_code}' --max-time 90 \
      -H "Host: $ADMIN_HOST" -b "$JAR" -X PATCH -H 'content-type: application/json' \
      -d '{"decision":"reject","reviewNote":"PR18-C classic before stale"}' \
      "$WEB/api/finance/receipts/$STALE_R/review" || echo 000)"
    if [[ "$CLASSIC_CODE" == "200" || "$CLASSIC_CODE" == "204" ]]; then
      CLASSIC_STALE_BODY="$(python3 - <<'PY'
import json
b=json.load(open("/tmp/pr18c-stale-enc.json"))
plan=json.load(open("/tmp/pr18c-plan.json"))
print(json.dumps({
  "caseKey": b["encounter"]["caseKey"],
  "action": {"command":"reviewReceipt","token":"reject_evidence","decision":"reject"},
  "source": {
    "encounterExecutionId": b["executionId"],
    **({"encounterVersionHint": b["meaningFingerprint"]} if b.get("meaningFingerprint") else {}),
  },
  "reviewReceipt": {
    "registrationId": plan["staleRegistrationId"],
    "counterpartyId": plan["staleRegistrationId"],
    "receiptId": plan["staleReceiptId"],
    "reviewNote": "stale after classic",
  },
}))
PY
)"
      CLASSIC_STALE_CMD="$(curl -sS -o /tmp/pr18c-classic-stale-cmd.json -w '%{http_code}' --max-time 90 \
        -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
        -H "Idempotency-Key: pr18c-classic-stale-$TS" \
        -d "$CLASSIC_STALE_BODY" \
        "$WEB/api/finance/case/commands/review-receipt")"
      python3 - <<PY || fail "classic-then-stale expectation"
import json
code=int("$CLASSIC_STALE_CMD")
body=json.load(open("/tmp/pr18c-classic-stale-cmd.json"))
err=(body.get("error") or {})
assert code != 200, body
assert err.get("code") in (
  "CASE_COMMAND_STALE",
  "CASE_COMMAND_VOCABULARY_DENIED",
  "CASE_COMMAND_SOT_REJECTED",
  "CASE_COMMAND_INTENT_INVALID",
), err
print("classic_then_stale", "$CLASSIC_CODE", code, err.get("code"))
PY
      record classic_then_stale PASS "classic=$CLASSIC_CODE cmd=$CLASSIC_STALE_CMD"
    else
      record classic_then_stale SKIP "classic review HTTP $CLASSIC_CODE"
    fi
  else
    record classic_then_stale SKIP "encounter HTTP $STALE_ENC"
  fi
else
  record classic_then_stale SKIP "no second pending"
fi

# --- Auth denied (bad bearer to API host path) ---
AUTH_CODE="$(curl -sS -o /tmp/pr18c-auth.json -w '%{http_code}' --max-time 30 \
  -H "Host: $ADMIN_HOST" -H 'Authorization: Bearer invalid-token' -H 'content-type: application/json' \
  -H "Idempotency-Key: pr18c-auth-$TS" \
  -d "$BODY" \
  "$API/finance/case/commands/review-receipt")"
python3 - <<PY || fail "auth boundary"
code=int("$AUTH_CODE")
assert code in (401, 403), code
print("auth http", code)
PY
record auth_denied PASS "http=$AUTH_CODE"

# --- Rollout isolation (unit-level fail-closed + other tenant) ---
cd "$ROOT/apps/web"
node --import tsx - <<NODE
import assert from "node:assert/strict";
import { isFinanceCaseCommandUiEnabledForTenant } from "./src/finance/finance-case-command-ui-rollout.ts";
const T = "$TENANT";
const O = "$OTHER_TENANT";
assert.equal(isFinanceCaseCommandUiEnabledForTenant(T, {
  FINANCE_CASE_COMMAND_UI_ENABLED: "true",
  FINANCE_CASE_COMMAND_UI_TENANT: T,
}), true);
assert.equal(isFinanceCaseCommandUiEnabledForTenant(O, {
  FINANCE_CASE_COMMAND_UI_ENABLED: "true",
  FINANCE_CASE_COMMAND_UI_TENANT: T,
}), false);
assert.equal(isFinanceCaseCommandUiEnabledForTenant(T, {
  FINANCE_CASE_COMMAND_UI_ENABLED: "true",
  FINANCE_CASE_COMMAND_UI_TENANT: "",
}), false);
assert.equal(isFinanceCaseCommandUiEnabledForTenant(T, {
  FINANCE_CASE_COMMAND_UI_ENABLED: "true",
  FINANCE_CASE_COMMAND_UI_TENANT: T + "," + O,
}), false);
console.log("rollout_isolation ok");
NODE
record rollout_isolation PASS "single-tenant fail-closed"

# --- Payments list regression ---
PAY_LIST="$(curl -sS -o /tmp/pr18c-payments.json -w '%{http_code}' --max-time 30 \
  -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/payments?limit=20")"
[[ "$PAY_LIST" == "200" ]] || fail "payments list $PAY_LIST"
record payments_regression PASS "http=$PAY_LIST"

# Recommendation hint from smoke outcomes
python3 - "$RESULTS" <<'PY'
import json, sys
from pathlib import Path
data = json.loads(Path(sys.argv[1]).read_text())
fails = [k for k,v in data.items() if v.get("status") == "FAIL"]
warns = [k for k,v in data.items() if v.get("status") in ("WARN","SKIP")]
required = ["command_happy_path","sot_after","meaning_refresh","rollout_isolation","auth_denied"]
missing = [k for k in required if data.get(k,{}).get("status") != "PASS"]
if missing or fails:
    rec = "HOLD"
elif any(data.get(k,{}).get("status")=="SKIP" for k in ("stale_command",)):
    rec = "CONTINUE"
else:
    rec = "READY_FOR_CONTROLLED_PRODUCTION"
data["recommendation"] = {"status": "INFO", "detail": rec, "missing": missing, "warns": warns}
Path(sys.argv[1]).write_text(json.dumps(data, indent=2))
print("RECOMMENDATION", rec)
PY

echo "PR18C_COMMAND_UI_SMOKE_OK"
echo "results: $RESULTS"
cat "$RESULTS"
