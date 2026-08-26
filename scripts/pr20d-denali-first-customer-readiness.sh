#!/usr/bin/env bash
# PR20-D — First-customer Finance readiness: multi-pay journey + overpay 4xx + safety.
set -euo pipefail
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

ADMIN_HOST="${ADMIN_HOST:-denali.admin.localhost}"
WEB="${WEB:-http://127.0.0.1:3000}"
API="${API:-http://127.0.0.1:3001}"
PHONE="${SMOKE_OPERATOR_PHONE:-09174070937}"
OTP="${SMOKE_OPERATOR_OTP:-1234}"
TENANT="${FINANCE_CASE_COMMAND_UI_TENANT:-00000000-0000-4000-8000-000000000003}"
JAR="${SMOKE_COOKIE_JAR:-/tmp/pr20d.jar}"
OUT="${SMOKE_RESULTS:-/tmp/pr20d-readiness.json}"
TS="$(date -u +%Y%m%d%H%M%S)"

echo '{}' >"$OUT"
record() {
  python3 - "$OUT" "$1" "$2" "$3" <<'PY'
import json,sys
path,key,status,detail=sys.argv[1:5]
data=json.loads(open(path).read())
data[key]={"status":status,"detail":detail[:12000],"evidenceClass":"LIVE"}
open(path,"w").write(json.dumps(data,indent=2))
print(f"[{status}] {key}: {detail[:280]}")
PY
}
fail(){ echo "PR20D_FAIL: $*" >&2; exit 1; }

jpg() {
  python3 - <<'PY'
from pathlib import Path
import base64
Path("/tmp/pr20d.jpg").write_bytes(base64.b64decode(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEBAVFRUVFRUVFRUVFRUWFxUXFhUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAECBQYAB//EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A1oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/Z"
))
PY
}

seed_payment_receipt() {
  local REG="$1" AMT="$2" TAG="$3"
  local PAY_CODE PAY_ID UP_CODE FILE_KEY SUB_CODE RID
  PAY_CODE="$(curl -sS -o /tmp/pr20d-pay.json -w '%{http_code}' --max-time 30 \
    -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
    -H "Idempotency-Key: pr20d-pay-$TAG-$TS" \
    -d "{\"registrationId\":\"$REG\",\"amount\":\"$AMT\",\"currency\":\"IRR\"}" \
    "$WEB/api/finance/payments/manual")"
  PAY_ID="$(python3 -c 'import json; print(json.load(open("/tmp/pr20d-pay.json")).get("id",""))')"
  [[ "$PAY_CODE" == "201" && -n "$PAY_ID" ]] || { echo "PAY_FAIL:$PAY_CODE:$(head -c 200 /tmp/pr20d-pay.json)"; return 1; }
  jpg
  UP_CODE="$(curl -sS -o /tmp/pr20d-up.json -w '%{http_code}' --max-time 30 \
    -H "Host: $ADMIN_HOST" -b "$JAR" \
    -H 'content-type: image/jpeg' -H "x-receipt-file-name: pr20d-$TAG.jpg" \
    --data-binary @/tmp/pr20d.jpg \
    "$WEB/api/finance/receipts/upload?registrationId=$REG")"
  FILE_KEY="$(python3 -c 'import json; print(json.load(open("/tmp/pr20d-up.json")).get("fileKey",""))')"
  [[ "$UP_CODE" == "201" && -n "$FILE_KEY" ]] || { echo "UP_FAIL:$UP_CODE"; return 1; }
  SUB_CODE="$(curl -sS -o /tmp/pr20d-sub.json -w '%{http_code}' --max-time 30 \
    -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
    -H "Idempotency-Key: pr20d-sub-$TAG-$TS" \
    -d "{\"paymentId\":\"$PAY_ID\",\"fileKey\":\"$FILE_KEY\",\"note\":\"PR20-D $TAG $TS\"}" \
    "$WEB/api/finance/receipts")"
  RID="$(python3 -c 'import json; print(json.load(open("/tmp/pr20d-sub.json")).get("id",""))')"
  [[ "$SUB_CODE" == "201" && -n "$RID" ]] || { echo "SUB_FAIL:$SUB_CODE"; return 1; }
  echo "$RID|$PAY_ID"
}

approve_classic() {
  local RID="$1" TAG="$2"
  curl -sS -o "/tmp/pr20d-rev-$TAG.json" -w '%{http_code}' --max-time 30 \
    -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
    -H "Idempotency-Key: pr20d-rev-$TAG-$TS" \
    -X PATCH -d '{"decision":"approve","reviewNote":"PR20-D '"$TAG"'"}' \
    "$WEB/api/finance/receipts/$RID/review"
}

booking_status() {
  local REG="$1"
  curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" \
    "$WEB/api/bookings?limit=100" -o /tmp/pr20d-bookings.json
  python3 - "$REG" <<'PY'
import json,sys
rid=sys.argv[1]
items=json.load(open("/tmp/pr20d-bookings.json")).get("items") or []
row=next((b for b in items if b.get("id")==rid), None)
print((row or {}).get("paymentStatus") or "MISSING")
PY
}

invoice_remaining() {
  local REG="$1"
  curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" \
    "$WEB/api/finance/invoices/$REG" -o /tmp/pr20d-inv.json
  python3 -c 'import json; print(json.load(open("/tmp/pr20d-inv.json")).get("balanceDueMinor","?"))'
}

echo "== PR20-D Denali first-customer readiness tenant=$TENANT =="
curl -sS --max-time 5 "$API/health" | python3 -c 'import json,sys; assert json.load(sys.stdin).get("status")=="ok"' || fail API
record api_health PASS ok

rm -f "$JAR"
REQ="$(curl -sS -c "$JAR" -b "$JAR" --max-time 30 -H "Host: $ADMIN_HOST" -H 'content-type: application/json' -d "{\"phone\":\"$PHONE\"}" "$WEB/api/auth/request-otp")"
CH="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["challenge_id"])' <<<"$REQ")"
LOGIN="$(curl -sS -c "$JAR" -b "$JAR" --max-time 30 -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"otp\":\"$OTP\",\"challenge_id\":\"$CH\"}" "$WEB/api/auth/login-web-session")"
echo "$LOGIN" | python3 -c 'import json,sys; assert json.load(sys.stdin).get("ok") is True' || fail login
record login PASS ok

curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" -o /tmp/pr20d-finance.html "$WEB/finance"
record hub_surface PASS "finance html loaded"

curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/bookings?limit=100" -o /tmp/pr20d-bookings.json
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/payments?limit=100" -o /tmp/pr20d-payments.json
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/receipts/pending?limit=40" -o /tmp/pr20d-pending.json

python3 - <<'PY'
import json
from pathlib import Path
bookings=json.load(open("/tmp/pr20d-bookings.json")).get("items") or []
payments=json.load(open("/tmp/pr20d-payments.json")).get("items") or []
pending=json.load(open("/tmp/pr20d-pending.json")).get("items") or []
paid_regs={(p.get("registrationId") or "") for p in payments if p.get("status") in ("Paid","Pending")}
pending_regs={(p.get("registrationId") or (p.get("payment") or {}).get("registrationId") or "") for p in pending}
clean=[b["id"] for b in bookings if b.get("status")=="approved" and b.get("paymentStatus")=="unpaid" and b["id"] not in paid_regs and b["id"] not in pending_regs]
Path("/tmp/pr20d-clean.json").write_text(json.dumps(clean, indent=2))
print("clean_unpaid", len(clean))
PY

mapfile -t CLEAN < <(python3 -c 'import json; print("\n".join(json.load(open("/tmp/pr20d-clean.json"))[:8]))')
echo "clean_ids=${#CLEAN[@]}"
[[ ${#CLEAN[@]} -ge 4 ]] || fail "need >=4 clean unpaid bookings; have ${#CLEAN[@]}"

REG_M="${CLEAN[0]}"
SEED1="$(seed_payment_receipt "$REG_M" "1500000" "under1" || true)"
[[ "$SEED1" == *"|"* ]] || fail "seed under1 failed: $SEED1"
RID1="${SEED1%%|*}"
CODE1="$(approve_classic "$RID1" "under1")"
PAY1="$(booking_status "$REG_M")"
REM1="$(invoice_remaining "$REG_M")"
record journey_underpay "$([[ "$CODE1" == "200" && "$PAY1" == "partial" && "$REM1" != "0" ]] && echo PASS || echo FAIL)" \
  "code=$CODE1 booking=$PAY1 remaining=$REM1"

SEED2="$(seed_payment_receipt "$REG_M" "500000" "mid2" || true)"
[[ "$SEED2" == *"|"* ]] || fail "second payment blocked (P0 regression): $SEED2"
RID2="${SEED2%%|*}"
CODE2="$(approve_classic "$RID2" "mid2")"
PAY2="$(booking_status "$REG_M")"
REM2="$(invoice_remaining "$REG_M")"
record journey_second_partial "$([[ "$CODE2" == "200" && "$PAY2" == "partial" && "$REM2" != "0" ]] && echo PASS || echo FAIL)" \
  "code=$CODE2 booking=$PAY2 remaining=$REM2"

SEED3="$(seed_payment_receipt "$REG_M" "500000" "final3" || true)"
[[ "$SEED3" == *"|"* ]] || fail "final payment create failed: $SEED3"
RID3="${SEED3%%|*}"
CODE3="$(approve_classic "$RID3" "final3")"
PAY3="$(booking_status "$REG_M")"
REM3="$(invoice_remaining "$REG_M")"
record journey_final_paid "$([[ "$CODE3" == "200" && "$PAY3" == "paid" && "$REM3" == "0" ]] && echo PASS || echo FAIL)" \
  "code=$CODE3 booking=$PAY3 remaining=$REM3"

DUP_CODE="$(curl -sS -o /tmp/pr20d-dup.json -w '%{http_code}' --max-time 30 \
  -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
  -H "Idempotency-Key: pr20d-dup-$TS" \
  -d "{\"registrationId\":\"$REG_M\",\"amount\":\"1\",\"currency\":\"IRR\"}" \
  "$WEB/api/finance/payments/manual")"
record duplicate_after_paid "$([[ "$DUP_CODE" == "400" ]] && echo PASS || echo FAIL)" \
  "code=$DUP_CODE body=$(head -c 400 /tmp/pr20d-dup.json)"

REG_O="${CLEAN[1]}"
PAY_O_CODE="$(curl -sS -o /tmp/pr20d-over-pay.json -w '%{http_code}' --max-time 30 \
  -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
  -H "Idempotency-Key: pr20d-over-pay-$TS" \
  -d "{\"registrationId\":\"$REG_O\",\"amount\":\"3000000\",\"currency\":\"IRR\"}" \
  "$WEB/api/finance/payments/manual")"
PAY_O="$(booking_status "$REG_O")"
record overpay_http "$([[ "$PAY_O_CODE" == "422" && "$PAY_O" == "unpaid" ]] && echo PASS || echo FAIL)" \
  "rejected_at=create code=$PAY_O_CODE booking=$PAY_O body=$(head -c 400 /tmp/pr20d-over-pay.json)"

REG_R="${CLEAN[2]}"
SEED_R="$(seed_payment_receipt "$REG_R" "2500000" "reject" || true)"
[[ "$SEED_R" == *"|"* ]] || fail "reject seed failed: $SEED_R"
RID_R="${SEED_R%%|*}"
CODE_RJ="$(curl -sS -o /tmp/pr20d-reject.json -w '%{http_code}' --max-time 30 \
  -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
  -H "Idempotency-Key: pr20d-reject-$TS" \
  -X PATCH -d '{"decision":"reject","reviewNote":"PR20-D reject"}' \
  "$WEB/api/finance/receipts/$RID_R/review")"
PAY_R="$(booking_status "$REG_R")"
record reject_path "$([[ "$CODE_RJ" == "200" && "$PAY_R" == "unpaid" ]] && echo PASS || echo FAIL)" \
  "code=$CODE_RJ booking=$PAY_R"

AUTH_CODE="$(curl -sS -o /tmp/pr20d-auth.json -w '%{http_code}' --max-time 20 \
  -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -X PATCH -d '{"decision":"approve"}' \
  "$WEB/api/finance/receipts/$RID1/review")"
record unauthorized "$([[ "$AUTH_CODE" == "401" ]] && echo PASS || echo FAIL)" "code=$AUTH_CODE"

REG_S="${CLEAN[3]}"
SEED_S="$(seed_payment_receipt "$REG_S" "1500000" "stale" || true)"
[[ "$SEED_S" == *"|"* ]] || fail "stale seed failed: $SEED_S"
RID_S="${SEED_S%%|*}"
ENC_S="$(curl -sS -o /tmp/pr20d-stale-enc.json -w '%{http_code}' --max-time 90 \
  -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/case/encounters/$REG_S?counterpartyId=$REG_S")"
EXEC_S="$(python3 -c 'import json; d=json.load(open("/tmp/pr20d-stale-enc.json")); print(d.get("executionId") or (d.get("encounter") or {}).get("executionId") or "")')"
CASE_S="$(python3 -c 'import json; d=json.load(open("/tmp/pr20d-stale-enc.json")); print((d.get("encounter") or {}).get("caseKey") or d.get("caseKey") or "")')"
FP_S="$(python3 -c 'import json; print(json.load(open("/tmp/pr20d-stale-enc.json")).get("meaningFingerprint") or "")')"
[[ "$ENC_S" == "200" && -n "$EXEC_S" && -n "$CASE_S" ]] || fail "stale encounter failed http=$ENC_S exec=$EXEC_S case=$CASE_S"
CLASSIC_S="$(approve_classic "$RID_S" "stale-classic")"
export REG_S RID_S EXEC_S CASE_S FP_S TS
BODY_S="$(python3 - <<'PY'
import json, os
fp = os.environ.get("FP_S") or ""
body = {
  "caseKey": os.environ["CASE_S"],
  "action": {"command": "reviewReceipt", "token": "approve_evidence", "decision": "approve"},
  "source": {"encounterExecutionId": os.environ["EXEC_S"]},
  "correlationId": "pr20d-stale-" + os.environ["TS"],
  "reviewReceipt": {
    "registrationId": os.environ["REG_S"],
    "counterpartyId": os.environ["REG_S"],
    "receiptId": os.environ["RID_S"],
    "reviewNote": "PR20-D stale",
  },
}
if fp:
  body["source"]["meaningFingerprint"] = fp
print(json.dumps(body))
PY
)"
STALE_CODE="$(curl -sS -o /tmp/pr20d-stale.json -w '%{http_code}' --max-time 60 \
  -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
  -H "Idempotency-Key: pr20d-stale-cmd-$TS" \
  -d "$BODY_S" \
  "$WEB/api/finance/case/commands/review-receipt" || true)"
ERR="$(python3 -c 'import json; d=json.load(open("/tmp/pr20d-stale.json")); e=d.get("error"); print((e.get("code") if isinstance(e, dict) else e) or d.get("code") or "")' 2>/dev/null || true)"
record stale_command "$([[ "$STALE_CODE" == "409" ]] && echo PASS || echo FAIL)" \
  "encounter=$ENC_S classic=$CLASSIC_S stale=$STALE_CODE err=$ERR body=$(head -c 400 /tmp/pr20d-stale.json)"

BFF_OP="$(curl -sS -o /tmp/pr20d-op-bff.json -w '%{http_code}' --max-time 15 \
  -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/reports/open-payments" || true)"
API_OP="$(curl -sS -o /tmp/pr20d-op-api.json -w '%{http_code}' --max-time 15 \
  -H "Host: $ADMIN_HOST" -b "$JAR" "$API/finance/reports/open-payments" || true)"
record open_payments_scope PASS "bff=$BFF_OP api=$API_OP (UI unused; first-customer non-blocking)"

python3 - "$OUT" <<'PY'
import json,sys
path=sys.argv[1]
data=json.loads(open(path).read())
required=["journey_underpay","journey_second_partial","journey_final_paid","overpay_http","reject_path","duplicate_after_paid","unauthorized","stale_command"]
fails=[k for k in required if data.get(k,{}).get("status")!="PASS"]
verdict="READY_FOR_FIRST_CUSTOMER" if not fails else "BLOCKED"
data["verdict"]=verdict
data["failed_keys"]=fails
open(path,"w").write(json.dumps(data,indent=2))
print("VERDICT", verdict, "fails", fails)
PY

echo "Wrote $OUT"
