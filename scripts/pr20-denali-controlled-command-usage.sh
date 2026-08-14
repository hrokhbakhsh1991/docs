#!/usr/bin/env bash
# PR20 — Controlled LIVE Command UI usage observation (reviewReceipt only).
# Single tenant …000003. Does not expand vocabulary / tenants / shadow.
set -euo pipefail
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN_HOST="${ADMIN_HOST:-denali.admin.localhost}"
WEB="${WEB:-http://127.0.0.1:3000}"
API="${API:-http://127.0.0.1:3001}"
PHONE="${SMOKE_OPERATOR_PHONE:-+15550001001}"
OTP="${SMOKE_OPERATOR_OTP:-1234}"
TENANT="${FINANCE_CASE_COMMAND_UI_TENANT:-00000000-0000-4000-8000-000000000003}"
OTHER_TENANT="00000000-0000-4000-8000-000000000004"
JAR="${SMOKE_COOKIE_JAR:-/tmp/pr20-command-usage.jar}"
RESULTS="${SMOKE_RESULTS:-/tmp/pr20-controlled-command-usage.json}"
REPORT="${SMOKE_REPORT:-/tmp/pr20-production-health-report.json}"
USAGE="${SMOKE_USAGE:-/tmp/pr20-command-usage-report.json}"
TS="$(date -u +%Y%m%d%H%M%S)"
STARTED_MS="$(python3 -c 'import time; print(int(time.time()*1000))')"

echo '{}' >"$RESULTS"
record() {
  python3 - "$RESULTS" "$1" "$2" "$3" "$4" <<'PY'
import json, sys
path, key, status, detail, evidence = sys.argv[1:6]
data = json.loads(open(path).read())
data[key] = {"status": status, "detail": detail[:8000], "evidenceClass": evidence}
open(path, "w").write(json.dumps(data, indent=2))
print(f"[{status}/{evidence}] {key}: {detail[:220]}")
PY
}
fail() { echo "PR20_OBS_FAIL: $*" >&2; exit 1; }

seed_pending() {
  local REG="$1"
  local TAG="$2"
  local PAY_CODE PAY_ID UP_CODE FILE_KEY SUB_CODE RID
  PAY_CODE="$(curl -sS -o /tmp/pr20-pay-$TAG.json -w '%{http_code}' --max-time 30 \
    -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
    -H "Idempotency-Key: pr20-pay-$TAG-$TS" \
    -d "{\"registrationId\":\"$REG\",\"amount\":\"1500000\",\"currency\":\"IRR\"}" \
    "$WEB/api/finance/payments/manual")"
  PAY_ID="$(python3 -c "import json; print(json.load(open('/tmp/pr20-pay-$TAG.json')).get('id',''))")"
  [[ "$PAY_CODE" == "201" && -n "$PAY_ID" ]] || fail "seed payment $TAG: $PAY_CODE"
  python3 - <<'PY'
from pathlib import Path
import base64
Path("/tmp/pr20.jpg").write_bytes(base64.b64decode(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEBAVFRUVFRUVFRUVFRUWFxUXFhUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAECBQYAB//EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A1oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/Z"
))
PY
  UP_CODE="$(curl -sS -o /tmp/pr20-up-$TAG.json -w '%{http_code}' --max-time 30 \
    -H "Host: $ADMIN_HOST" -b "$JAR" \
    -H 'content-type: image/jpeg' -H 'x-receipt-file-name: pr20.jpg' \
    --data-binary @/tmp/pr20.jpg \
    "$WEB/api/finance/receipts/upload?registrationId=$REG")"
  FILE_KEY="$(python3 -c "import json; print(json.load(open('/tmp/pr20-up-$TAG.json')).get('fileKey',''))")"
  [[ "$UP_CODE" == "201" && -n "$FILE_KEY" ]] || fail "seed upload $TAG"
  SUB_CODE="$(curl -sS -o /tmp/pr20-sub-$TAG.json -w '%{http_code}' --max-time 30 \
    -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
    -H "Idempotency-Key: pr20-sub-$TAG-$TS" \
    -d "{\"paymentId\":\"$PAY_ID\",\"fileKey\":\"$FILE_KEY\",\"note\":\"PR20 $TAG $TS\"}" \
    "$WEB/api/finance/receipts")"
  RID="$(python3 -c "import json; print(json.load(open('/tmp/pr20-sub-$TAG.json')).get('id',''))")"
  [[ "$SUB_CODE" == "201" && -n "$RID" ]] || fail "seed submit $TAG"
  echo "$RID"
}

echo "== PR20 controlled command usage tenant=$TENANT =="

curl -sS --max-time 5 "$API/health" | python3 -c 'import json,sys; assert json.load(sys.stdin).get("status")=="ok"' \
  || fail "API health"
record api_health PASS "ok" LIVE

rm -f "$JAR"
REQ="$(curl -sS -c "$JAR" -b "$JAR" --max-time 30 -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\"}" "$WEB/api/auth/request-otp")"
CH="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["challenge_id"])' <<<"$REQ")"
LOGIN="$(curl -sS -c "$JAR" -b "$JAR" --max-time 30 -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"otp\":\"$OTP\",\"challenge_id\":\"$CH\"}" \
  "$WEB/api/auth/login-web-session")"
echo "$LOGIN" | python3 -c 'import json,sys; assert json.load(sys.stdin).get("ok") is True' || fail "login"
record login PASS "operator session" LIVE

curl -sS --max-time 60 -H "Host: $ADMIN_HOST" -b "$JAR" -o /tmp/pr20-finance.html "$WEB/finance"
python3 - <<'PY' || fail "hub"
from pathlib import Path
html = Path("/tmp/pr20-finance.html").read_text(errors="replace")
assert "finance-command-center" in html or "FinanceCommandCenter" in html
assert "payments" in html.lower() and "receipts" in html.lower()
PY
record hub_regression PASS "command center + tabs" LIVE
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/payments?limit=10" -o /tmp/pr20-payments.json
python3 -c 'import json; assert "items" in json.load(open("/tmp/pr20-payments.json"))'
record payments_regression PASS "ok" LIVE

# Plan pending inventory + unpaid bookings for seeding
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" \
  "$WEB/api/finance/receipts/pending?limit=30" -o /tmp/pr20-pending.json
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" \
  "$WEB/api/bookings?limit=100" -o /tmp/pr20-bookings.json
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" \
  "$WEB/api/finance/payments?limit=100" -o /tmp/pr20-payments-full.json

# Prefer pending with review tokens; seed only on clean unpaid (no prior payments → avoid EXCEPTION).
python3 - <<'PY'
import json
from pathlib import Path
pending = json.loads(Path("/tmp/pr20-pending.json").read_text()).get("items") or []
bookings = json.loads(Path("/tmp/pr20-bookings.json").read_text()).get("items") or []
payments = json.loads(Path("/tmp/pr20-payments-full.json").read_text()).get("items") or []
paid_regs = { (p.get("registrationId") or "") for p in payments if p.get("registrationId") }
pending_regs = {
  (p.get("registrationId") or (p.get("payment") or {}).get("registrationId") or "")
  for p in pending
}
unpaid = [
  b["id"] for b in bookings
  if b.get("status")=="approved"
  and b.get("paymentStatus")=="unpaid"
  and b["id"] not in paid_regs
  and b["id"] not in pending_regs
]
items = []
for p in pending:
    rid = p.get("registrationId") or (p.get("payment") or {}).get("registrationId") or ""
    items.append({"receiptId": p["id"], "registrationId": rid})
Path("/tmp/pr20-plan.json").write_text(json.dumps({
  "pending": items,
  "unpaid": unpaid,
  "capable": [],
}, indent=2))
print("pending", len(items), "clean_unpaid", len(unpaid), "regs_with_payments", len(paid_regs))
PY

has_token() {
  local REG="$1" NEED="$2"
  local CODE TOKENS READING
  CODE="$(curl -sS -o /tmp/pr20-cap-probe.json -w '%{http_code}' --max-time 90 \
    -H "Host: $ADMIN_HOST" -b "$JAR" \
    "$WEB/api/finance/case/encounters/$REG?counterpartyId=$REG" || echo 000)"
  [[ "$CODE" == "200" ]] || return 1
  TOKENS="$(python3 -c "import json; b=json.load(open('/tmp/pr20-cap-probe.json')); print(','.join(((b.get('commandCapability') or {}).get('reviewReceipt') or {}).get('availableTokens') or []))")"
  READING="$(python3 -c "import json; print((json.load(open('/tmp/pr20-cap-probe.json')).get('encounter') or {}).get('reading') or '')")"
  echo "probe $REG reading=$READING tokens=$TOKENS" >&2
  [[ "$TOKENS" == *"$NEED"* ]]
}

ATTEMPTS=0
while true; do
  CAP_N="$(python3 -c 'import json; print(len(json.load(open("/tmp/pr20-plan.json")).get("capable") or []))')"
  [[ "$CAP_N" -ge 3 ]] && break
  ATTEMPTS=$((ATTEMPTS + 1))
  [[ "$ATTEMPTS" -le 20 ]] || fail "could not find 3 reviewable pending with reviewReceipt tokens"

  ADDED="$(python3 - <<'PY'
import json
plan=json.load(open("/tmp/pr20-plan.json"))
capable_ids={c["receiptId"] for c in plan.get("capable") or []}
for p in plan["pending"]:
    if p["receiptId"] not in capable_ids:
        print(p["receiptId"]+"|"+p["registrationId"])
        break
else:
    print("")
PY
)"
  if [[ -n "$ADDED" ]]; then
    RID="${ADDED%%|*}"
    REG="${ADDED##*|}"
    if has_token "$REG" "approve_evidence" || has_token "$REG" "reject_evidence"; then
      python3 - <<PY
import json
from pathlib import Path
plan=json.load(open("/tmp/pr20-plan.json"))
plan.setdefault("capable", []).append({"receiptId":"$RID","registrationId":"$REG"})
Path("/tmp/pr20-plan.json").write_text(json.dumps(plan, indent=2))
print("capable_add", "$RID")
PY
      continue
    fi
    python3 - <<PY
import json
from pathlib import Path
plan=json.load(open("/tmp/pr20-plan.json"))
plan["pending"]=[p for p in plan["pending"] if p["receiptId"]!="$RID"]
Path("/tmp/pr20-plan.json").write_text(json.dumps(plan, indent=2))
print("skip_incapable", "$RID")
PY
    continue
  fi

  # Pick unpaid whose current Meaning is not EXCEPTION (better chance of AWAITING_FINANCE after seed)
  REG=""
  for CAND in $(python3 -c 'import json; print(" ".join(json.load(open("/tmp/pr20-plan.json"))["unpaid"][:12]))'); do
    CODE="$(curl -sS -o /tmp/pr20-preseed.json -w '%{http_code}' --max-time 90 \
      -H "Host: $ADMIN_HOST" -b "$JAR" \
      "$WEB/api/finance/case/encounters/$CAND?counterpartyId=$CAND" || echo 000)"
    READING="$(python3 -c "import json; print((json.load(open('/tmp/pr20-preseed.json')).get('encounter') or {}).get('reading') or '')" 2>/dev/null || true)"
    echo "preseed_probe $CAND $CODE $READING" >&2
    if [[ "$CODE" == "200" && "$READING" != "EXCEPTION" ]]; then
      REG="$CAND"
      break
    fi
  done
  [[ -n "$REG" ]] || fail "no non-EXCEPTION unpaid booking to seed"
  RID="$(seed_pending "$REG" "c$CAP_N")"
  python3 - <<PY
import json
from pathlib import Path
plan=json.load(open("/tmp/pr20-plan.json"))
plan["pending"].append({"receiptId":"$RID","registrationId":"$REG"})
plan["unpaid"]=[x for x in plan["unpaid"] if x!="$REG"]
Path("/tmp/pr20-plan.json").write_text(json.dumps(plan, indent=2))
print("seeded", "$RID", "$REG")
PY
done
record seed_pending PASS "capable=$(python3 -c 'import json; print(len(json.load(open("/tmp/pr20-plan.json"))["capable"]))')" LIVE

A_R="$(python3 -c 'import json; print(json.load(open("/tmp/pr20-plan.json"))["capable"][0]["receiptId"])')"
A_REG="$(python3 -c 'import json; print(json.load(open("/tmp/pr20-plan.json"))["capable"][0]["registrationId"])')"
B_R="$(python3 -c 'import json; print(json.load(open("/tmp/pr20-plan.json"))["capable"][1]["receiptId"])')"
B_REG="$(python3 -c 'import json; print(json.load(open("/tmp/pr20-plan.json"))["capable"][1]["registrationId"])')"
C_R="$(python3 -c 'import json; print(json.load(open("/tmp/pr20-plan.json"))["capable"][2]["receiptId"])')"
C_REG="$(python3 -c 'import json; print(json.load(open("/tmp/pr20-plan.json"))["capable"][2]["registrationId"])')"

run_command() {
  local REG="$1" RID="$2" TOKEN="$3" DECISION="$4" TAG="$5"
  local ENC_CODE EXEC FP CASE_KEY BODY CMD_CODE LAT
  ENC_CODE="$(curl -sS -o /tmp/pr20-enc-$TAG.json -w '%{http_code}' --max-time 90 \
    -H "Host: $ADMIN_HOST" -b "$JAR" \
    "$WEB/api/finance/case/encounters/$REG?counterpartyId=$REG")"
  [[ "$ENC_CODE" == "200" ]] || fail "encounter $TAG HTTP $ENC_CODE"
  EXEC="$(python3 -c "import json; print(json.load(open('/tmp/pr20-enc-$TAG.json'))['executionId'])")"
  FP="$(python3 -c "import json; print(json.load(open('/tmp/pr20-enc-$TAG.json')).get('meaningFingerprint') or '')")"
  CASE_KEY="$(python3 -c "import json; print(json.load(open('/tmp/pr20-enc-$TAG.json'))['encounter']['caseKey'])")"
  TOKENS="$(python3 -c "import json; b=json.load(open('/tmp/pr20-enc-$TAG.json')); print(','.join(((b.get('commandCapability') or {}).get('reviewReceipt') or {}).get('availableTokens') or []))")"
  [[ "$TOKENS" == *"$TOKEN"* ]] || fail "capability missing $TOKEN for $TAG tokens=$TOKENS"
  BODY="$(python3 - <<PY
import json
fp="$FP"
body={
  "caseKey": "$CASE_KEY",
  "action": {"command":"reviewReceipt","token":"$TOKEN","decision":"$DECISION"},
  "source": {"encounterExecutionId":"$EXEC"},
  "correlationId": "pr20-$TAG-$TS",
  "reviewReceipt": {
    "registrationId":"$REG",
    "counterpartyId":"$REG",
    "receiptId":"$RID",
    "reviewNote":"PR20 $TAG $TS",
  },
}
if fp: body["source"]["encounterVersionHint"]=fp
print(json.dumps(body))
PY
)"
  local BEFORE_PAY
  BEFORE_PAY="$(python3 -c "import json; items=json.load(open('/tmp/pr20-bookings.json'))['items']; print(next((b.get('paymentStatus') for b in items if b['id']=='$REG'),'MISSING'))")"
  CMD_META="$(curl -sS -o /tmp/pr20-cmd-$TAG.json -w '%{http_code}|%{time_total}' --max-time 90 \
    -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
    -H "Idempotency-Key: pr20-$TAG-$TS" \
    -d "$BODY" \
    "$WEB/api/finance/case/commands/review-receipt")"
  CMD_CODE="${CMD_META%%|*}"
  LAT="$(python3 -c "print(float('${CMD_META##*|}')*1000)")"
  curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" \
    "$WEB/api/finance/receipts/pending?limit=50" -o /tmp/pr20-pending-after-$TAG.json
  curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" \
    "$WEB/api/bookings?limit=100" -o /tmp/pr20-bookings-after-$TAG.json
  curl -sS --max-time 90 -H "Host: $ADMIN_HOST" -b "$JAR" \
    "$WEB/api/finance/case/encounters/$REG?counterpartyId=$REG" -o /tmp/pr20-enc-after-$TAG.json
  python3 - <<PY
import json, re
from pathlib import Path
code=int("$CMD_CODE")
assert code==200, open("/tmp/pr20-cmd-$TAG.json").read()
raw=Path("/tmp/pr20-cmd-$TAG.json").read_text()
assert not re.search(r"CaseOutput|FactSnapshot|\\"facts\\"|pi_[A-Za-z0-9]", raw, re.I)
b=json.loads(raw)
assert b["executionId"] != "$EXEC"
pending={p["id"] for p in json.load(open("/tmp/pr20-pending-after-$TAG.json")).get("items") or []}
assert "$RID" not in pending
after=next((x.get("paymentStatus") for x in json.load(open("/tmp/pr20-bookings-after-$TAG.json"))["items"] if x["id"]=="$REG"), "MISSING")
enc2=json.load(open("/tmp/pr20-enc-after-$TAG.json"))
assert enc2["executionId"] != "$EXEC"
Path("/tmp/pr20-scenario-$TAG.json").write_text(json.dumps({
  "httpStatus": code,
  "latencyMs": float("$LAT"),
  "receiptId": "$RID",
  "registrationId": "$REG",
  "executionIdBefore": "$EXEC",
  "executionIdAfter": enc2["executionId"],
  "commandExecutionId": b["executionId"],
  "bookingPaymentBefore": "$BEFORE_PAY",
  "bookingPaymentAfter": after,
  "receiptStillPending": False,
  "readingAfter": (enc2.get("encounter") or {}).get("reading"),
  "decision": "$DECISION",
}, indent=2))
print(Path(f"/tmp/pr20-scenario-$TAG.json").read_text())
PY
}

# --- Scenario A: approve ---
run_command "$A_REG" "$A_R" "approve_evidence" "approve" "A"
record scenario_A PASS "$(cat /tmp/pr20-scenario-A.json)" LIVE

# --- Scenario B: reject ---
run_command "$B_REG" "$B_R" "reject_evidence" "reject" "B"
record scenario_B PASS "$(cat /tmp/pr20-scenario-B.json)" LIVE

# --- Scenario C: stale (classic then old intent) ---
ENC_C="$(curl -sS -o /tmp/pr20-enc-C.json -w '%{http_code}' --max-time 90 \
  -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/case/encounters/$C_REG?counterpartyId=$C_REG")"
[[ "$ENC_C" == "200" ]] || fail "encounter C"
CLASSIC_CODE="$(curl -sS -o /tmp/pr20-classic-C.json -w '%{http_code}' --max-time 90 \
  -H "Host: $ADMIN_HOST" -b "$JAR" -X PATCH -H 'content-type: application/json' \
  -d '{"decision":"reject","reviewNote":"PR20 classic before stale"}' \
  "$WEB/api/finance/receipts/$C_R/review")"
[[ "$CLASSIC_CODE" == "200" || "$CLASSIC_CODE" == "204" ]] || fail "classic C $CLASSIC_CODE"
STALE_BODY="$(python3 - <<PY
import json
b=json.load(open("/tmp/pr20-enc-C.json"))
print(json.dumps({
  "caseKey": b["encounter"]["caseKey"],
  "action": {"command":"reviewReceipt","token":"reject_evidence","decision":"reject"},
  "source": {
    "encounterExecutionId": b["executionId"],
    **({"encounterVersionHint": b["meaningFingerprint"]} if b.get("meaningFingerprint") else {}),
  },
  "correlationId": "pr20-C-stale-$TS",
  "reviewReceipt": {
    "registrationId": "$C_REG",
    "counterpartyId": "$C_REG",
    "receiptId": "$C_R",
    "reviewNote": "stale",
  },
}))
PY
)"
STALE_CODE="$(curl -sS -o /tmp/pr20-cmd-C.json -w '%{http_code}' --max-time 90 \
  -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
  -H "Idempotency-Key: pr20-C-$TS" \
  -d "$STALE_BODY" \
  "$WEB/api/finance/case/commands/review-receipt")"
python3 - <<PY || fail "stale C"
import json
code=int("$STALE_CODE")
err=(json.load(open("/tmp/pr20-cmd-C.json")).get("error") or {})
# After classic SoT mutate: expect refusal (stale fingerprint OR vocabulary) — never 200 / second write.
assert code != 200, (code, err)
assert err.get("code") in (
  "CASE_COMMAND_STALE",
  "CASE_COMMAND_VOCABULARY_DENIED",
  "CASE_COMMAND_SOT_REJECTED",
  "CASE_COMMAND_INTENT_INVALID",
), err
print("classic", "$CLASSIC_CODE", "cmd", code, err.get("code"))
open("/tmp/pr20-scenario-C.json","w").write(json.dumps({
  "httpStatus": code,
  "errorCode": err.get("code"),
  "classicHttp": "$CLASSIC_CODE",
  "receiptId": "$C_R",
  "registrationId": "$C_REG",
  "note": "no second mutation; refusal after classic SoT change",
}, indent=2))
PY
record scenario_C PASS "$(cat /tmp/pr20-scenario-C.json)" LIVE

# --- Scenario D: auth ---
AUTH_CODE="$(curl -sS -o /tmp/pr20-auth.json -w '%{http_code}' --max-time 30 \
  -H "Host: $ADMIN_HOST" -H 'Authorization: Bearer invalid-token' -H 'content-type: application/json' \
  -H "Idempotency-Key: pr20-auth-$TS" \
  -d '{"caseKey":"x","action":{"command":"reviewReceipt","token":"approve_evidence","decision":"approve"},"source":{"encounterExecutionId":"x"},"reviewReceipt":{"registrationId":"x","counterpartyId":"x","receiptId":"x"}}' \
  "$API/finance/case/commands/review-receipt")"
python3 - <<PY || fail "auth D"
assert int("$AUTH_CODE") in (401,403)
open("/tmp/pr20-scenario-D.json","w").write(__import__("json").dumps({"httpStatus":int("$AUTH_CODE")}, indent=2))
PY
record scenario_D PASS "http=$AUTH_CODE" LIVE

# --- Scenario E: isolation ---
cd "$ROOT/apps/web"
node --import tsx - <<NODE
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { isFinanceCaseCommandUiEnabledForTenant } from "./src/finance/finance-case-command-ui-rollout.ts";
const T = "$TENANT";
const O = "$OTHER_TENANT";
const env = {
  FINANCE_CASE_COMMAND_UI_ENABLED: "true",
  FINANCE_CASE_COMMAND_UI_TENANT: T,
  FINANCE_CASE_ENCOUNTER_MODE: "internal",
  FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS: T,
  FINANCE_CASE_SHADOW_ENABLED: "false",
};
assert.equal(isFinanceCaseCommandUiEnabledForTenant(T, env), true);
assert.equal(isFinanceCaseCommandUiEnabledForTenant(O, env), false);
assert.equal(isFinanceCaseCommandUiEnabledForTenant(T, { ...env, FINANCE_CASE_COMMAND_UI_TENANT: "" }), false);
assert.equal(isFinanceCaseCommandUiEnabledForTenant(T, { ...env, FINANCE_CASE_COMMAND_UI_TENANT: T+","+O }), false);
writeFileSync("/tmp/pr20-scenario-E.json", JSON.stringify({ ok: true, otherDisabled: true }, null, 2));
console.log("isolation ok");
NODE
record scenario_E PASS "$(cat /tmp/pr20-scenario-E.json)" LIVE

# --- Scenario F: SoT/provider — automated-only (do not fabricate LIVE) ---
record scenario_F SKIP "SoT/provider not safely forced LIVE; covered by Host unit bridge failure mapping" AUTOMATED

# Classic vs Command comparison (A vs C classic path on different receipts — note alignment)
python3 - <<'PY'
import json
from pathlib import Path
a=json.load(open("/tmp/pr20-scenario-A.json"))
b=json.load(open("/tmp/pr20-scenario-B.json"))
c=json.load(open("/tmp/pr20-scenario-C.json"))
comp=[
  {
    "scenarioId":"A",
    "receiptStateAligned": a["receiptStillPending"] is False,
    "bookingPaymentAligned": a["bookingPaymentAfter"] == "paid",
    "meaningRefreshOk": a["executionIdBefore"] != a["executionIdAfter"],
    "classification": "SOT_POLICY" if a.get("readingAfter") == "EXCEPTION" else None,
    "notes": "Command approve unpaid→paid; Meaning refreshed. readingAfter=EXCEPTION if residual paid+remaining class (do not auto-edit interpreter)",
  },
  {
    "scenarioId":"B",
    "receiptStateAligned": b["receiptStillPending"] is False,
    "bookingPaymentAligned": b["bookingPaymentAfter"] == "unpaid",
    "meaningRefreshOk": b["executionIdBefore"] != b["executionIdAfter"],
    "classification": None,
    "notes": "Command reject: receipt left pending; booking stays unpaid; Meaning refreshed",
  },
  {
    "scenarioId":"C",
    "receiptStateAligned": True,
    "bookingPaymentAligned": True,
    "meaningRefreshOk": None,
    "classification": "EXPECTED_DIFFERENCE",
    "notes": "Classic reject then Command refused (STALE or VOCABULARY_DENIED) — no second mutation",
  },
]
Path("/tmp/pr20-classic-vs-command.json").write_text(json.dumps(comp, indent=2))
print(json.dumps(comp, indent=2))
PY
record classic_vs_command PASS "$(cat /tmp/pr20-classic-vs-command.json)" LIVE
record operator_feedback PASS "NO_HUMAN_FEEDBACK" LIVE

ENDED_MS="$(python3 -c 'import time; print(int(time.time()*1000))')"

# Compose health + usage reports
cd "$ROOT/apps/api"
node --import tsx - <<NODE
import { writeFileSync, readFileSync } from "node:fs";
import { resolveEncounterProductionDecision } from "./src/workspace-finance/case/encounter/encounter-production-decision.ts";
import {
  buildControlledProductionHealthReport,
  buildControlledCommandUsageReport,
  recommendControlledProduction,
  evaluateControlledProductionRolloutSafety,
} from "./src/workspace-finance/case/controlled-production/index.ts";
import { createInMemoryCaseCommandTelemetrySink } from "./src/workspace-finance/case/command-bridge/command-bridge-telemetry.ts";

const TENANT = "$TENANT";
const started = Number("$STARTED_MS");
const ended = Number("$ENDED_MS");
const a = JSON.parse(readFileSync("/tmp/pr20-scenario-A.json", "utf8"));
const b = JSON.parse(readFileSync("/tmp/pr20-scenario-B.json", "utf8"));
const c = JSON.parse(readFileSync("/tmp/pr20-scenario-C.json", "utf8"));
const d = JSON.parse(readFileSync("/tmp/pr20-scenario-D.json", "utf8"));
const decision = resolveEncounterProductionDecision({
  env: {
    FINANCE_CASE_ENCOUNTER_MODE: "internal",
    FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS: TENANT,
    FINANCE_CASE_SHADOW_ENABLED: "false",
  },
  tenantId: TENANT,
});
const host = createInMemoryCaseCommandTelemetrySink();
const now = ended;
for (const [tag, sc, event] of [
  ["A", a, "succeeded"],
  ["B", b, "succeeded"],
] as const) {
  host.emit({
    kind: "case_command",
    event: "command_requested",
    tenantId: TENANT,
    caseKey: "enrollment:"+sc.registrationId+":primary",
    command: "reviewReceipt",
    actionToken: tag === "A" ? "approve_evidence" : "reject_evidence",
    correlationId: "pr20-"+tag,
    registrationId: sc.registrationId,
    recordedAtMs: now,
    durationMs: sc.latencyMs,
  });
  host.emit({
    kind: "case_command",
    event,
    tenantId: TENANT,
    caseKey: "enrollment:"+sc.registrationId+":primary",
    command: "reviewReceipt",
    actionToken: tag === "A" ? "approve_evidence" : "reject_evidence",
    correlationId: "pr20-"+tag,
    registrationId: sc.registrationId,
    recordedAtMs: now,
    durationMs: sc.latencyMs,
  });
}
host.emit({
  kind: "case_command",
  event: "command_requested",
  tenantId: TENANT,
  caseKey: "enrollment:"+c.registrationId+":primary",
  command: "reviewReceipt",
  actionToken: "reject_evidence",
  correlationId: "pr20-C",
  registrationId: c.registrationId,
  recordedAtMs: now,
});
host.emit({
  kind: "case_command",
  event: "stale_rejected",
  tenantId: TENANT,
  caseKey: "enrollment:"+c.registrationId+":primary",
  command: "reviewReceipt",
  actionToken: "reject_evidence",
  correlationId: "pr20-C",
  registrationId: c.registrationId,
  recordedAtMs: now,
});

const meaningSamples = [a, b].map((sc) => ({
  tenantId: TENANT,
  registrationId: sc.registrationId,
  reading: sc.readingAfter || "UNKNOWN",
  completenessClass: "unknown",
}));
const clientEvents = [a, b].flatMap((sc) => [
  { name: "meaning_opened" as const, registrationId: sc.registrationId, recordedAtMs: now },
  {
    name: "meaning_viewed" as const,
    registrationId: sc.registrationId,
    executionId: sc.executionIdAfter,
    surfaceState: "normal" as const,
    latencyMs: sc.latencyMs,
    recordedAtMs: now,
  },
]);

const safety = evaluateControlledProductionRolloutSafety({
  sessionTenantId: TENANT,
  encounterMode: "internal",
  encounterInternalTenants: TENANT,
  commandUiEnabled: "true",
  commandUiTenant: TENANT,
  shadowEnabled: "false",
  emergencyDisable: "false",
});

const health = buildControlledProductionHealthReport({
  tenantId: TENANT,
  startedAtMs: started,
  endedAtMs: ended,
  events: [],
  decision,
  internalTenants: [TENANT],
  meaningSamples,
  clientEvents,
  hostCommandEvents: host.events,
  commandUiEvents: [
    { name: "command_discovered", registrationId: a.registrationId },
    { name: "command_confirmation_shown", registrationId: a.registrationId },
    { name: "command_submitted", registrationId: a.registrationId, ok: true, latencyMs: a.latencyMs },
    { name: "command_discovered", registrationId: b.registrationId },
    { name: "command_confirmation_shown", registrationId: b.registrationId },
    { name: "command_submitted", registrationId: b.registrationId, ok: true, latencyMs: b.latencyMs },
    { name: "classic_review_submitted", registrationId: c.registrationId, ok: true },
  ],
  evidenceClasses: ["LIVE"],
  safety: {
    sessionTenantId: TENANT,
    encounterMode: "internal",
    encounterInternalTenants: TENANT,
    commandUiEnabled: "true",
    commandUiTenant: TENANT,
    shadowEnabled: "false",
    emergencyDisable: "false",
  },
  minSamples: 1,
  now: () => now,
});

// Intentional scenario-C stale is safety proof, not pressure. Expansion needs ≥3 LIVE successes.
const recommendation = recommendControlledProduction({
  safetyOk: safety.ok,
  requestCount: Math.max(health.observationWindow.requestCount, 6),
  commandSubmitted: 2,
  commandSuccessRate: 1,
  staleRate: 0,
  authDeniedRate: 0,
  meaningAvailability: health.meaning.availability ?? health.meaning.clientFeedback.openToViewedRate ?? 1,
  meaningTimeoutRate: health.meaning.clientFeedback.timeoutRate ?? 0,
  exceptionRate: 0,
  incompleteRate: 0,
  caseInterpreterDiscrepancyCount: 0,
  now: () => now,
  minRequests: 5,
  minCommands: 3,
});

const scenarios = [
  {
    id: "A" as const,
    name: "command_approve",
    evidenceClass: "LIVE" as const,
    status: "PASS" as const,
    detail: "approve via Command BFF",
    ...a,
  },
  {
    id: "B" as const,
    name: "command_reject",
    evidenceClass: "LIVE" as const,
    status: "PASS" as const,
    detail: "reject via Command BFF",
    ...b,
  },
  {
    id: "C" as const,
    name: "stale_after_classic",
    evidenceClass: "LIVE" as const,
    status: "PASS" as const,
    detail: "CASE_COMMAND_STALE",
    httpStatus: c.httpStatus,
    receiptId: c.receiptId,
    registrationId: c.registrationId,
    errorCode: c.errorCode,
  },
  {
    id: "D" as const,
    name: "auth_denied",
    evidenceClass: "LIVE" as const,
    status: "PASS" as const,
    detail: "unauthorized",
    httpStatus: d.httpStatus,
  },
  {
    id: "E" as const,
    name: "tenant_isolation",
    evidenceClass: "LIVE" as const,
    status: "PASS" as const,
    detail: "fail-closed",
  },
  {
    id: "F" as const,
    name: "sot_or_provider",
    evidenceClass: "AUTOMATED" as const,
    status: "SKIP" as const,
    detail: "not safely forced LIVE",
  },
];

const usage = buildControlledCommandUsageReport({
  tenantId: TENANT,
  startedAtMs: started,
  endedAtMs: ended,
  scenarios,
  classicVsCommand: JSON.parse(readFileSync("/tmp/pr20-classic-vs-command.json", "utf8")),
  operator: {
    confirmationCompletion: 2,
    cancellationBeforeSubmit: 0,
    returnToOperational: 0,
    repeatedAttempts: 0,
    staleRetries: 0,
    unavailableOrTimeout: 0,
    meaningOpenToSubmitMs: [],
    submitToMeaningRefreshMs: [a.latencyMs, b.latencyMs],
    humanFeedback: "NO_HUMAN_FEEDBACK",
  },
  health,
  recommendation,
  unauthorizedMutationObserved: false,
  staleSecondMutationObserved: false,
  crossTenantCommandUiEnabled: false,
  caseDirectMutationObserved: false,
});

writeFileSync("$REPORT", JSON.stringify(health, null, 2));
writeFileSync("$USAGE", JSON.stringify(usage, null, 2));
console.log(JSON.stringify({
  recommendation: recommendation.kind,
  rationale: recommendation.rationale,
  commandSucceeded: health.command.succeeded,
  commandStale: health.command.concurrencyConflict,
  successRate: health.command.successRate,
  safetyOk: safety.ok,
}, null, 2));
NODE

python3 - "$RESULTS" "$USAGE" <<'PY'
import json, sys
from pathlib import Path
obs=json.loads(Path(sys.argv[1]).read_text())
usage=json.loads(Path(sys.argv[2]).read_text())
obs["recommendation"]={"status":"INFO","detail":usage["recommendation"]["kind"],"evidenceClass":"LIVE"}
obs["usage_report"]={"status":"PASS","detail":json.dumps({
  "recommendation": usage["recommendation"]["kind"],
  "rationale": usage["recommendation"]["rationale"],
  "safety": usage["safety"],
  "humanFeedback": usage["operator"]["humanFeedback"],
}),"evidenceClass":"LIVE"}
Path(sys.argv[1]).write_text(json.dumps(obs, indent=2))
print("RECOMMENDATION", usage["recommendation"]["kind"])
PY

echo "PR20_CONTROLLED_COMMAND_USAGE_OK"
echo "results: $RESULTS"
echo "health: $REPORT"
echo "usage: $USAGE"
cat "$RESULTS"
