#!/usr/bin/env bash
# PR20-B — Live SoT paid-vs-remaining policy validation (tenant …000003 only).
# Does not expand allowlist / shadow / vocabulary.
set -euo pipefail
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

ADMIN_HOST="${ADMIN_HOST:-denali.admin.localhost}"
WEB="${WEB:-http://127.0.0.1:3000}"
API="${API:-http://127.0.0.1:3001}"
PHONE="${SMOKE_OPERATOR_PHONE:-09174070937}"
OTP="${SMOKE_OPERATOR_OTP:-1234}"
TENANT="${FINANCE_CASE_COMMAND_UI_TENANT:-00000000-0000-4000-8000-000000000003}"
JAR="${SMOKE_COOKIE_JAR:-/tmp/pr20b.jar}"
OUT="${SMOKE_RESULTS:-/tmp/pr20b-live-validation.json}"
TS="$(date -u +%Y%m%d%H%M%S)"

echo '{}' >"$OUT"
record() {
  python3 - "$OUT" "$1" "$2" "$3" <<'PY'
import json, sys
path, key, status, detail = sys.argv[1:5]
data = json.loads(open(path).read())
data[key] = {"status": status, "detail": detail[:8000]}
open(path, "w").write(json.dumps(data, indent=2))
print(f"[{status}] {key}: {detail[:300]}")
PY
}
fail() { echo "PR20B_FAIL: $*" >&2; exit 1; }

seed_receipt() {
  local REG="$1" AMT="$2" TAG="$3"
  local PAY_CODE PAY_ID UP_CODE FILE_KEY SUB_CODE RID
  PAY_CODE="$(curl -sS -o /tmp/pr20b-pay.json -w '%{http_code}' --max-time 30 \
    -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
    -H "Idempotency-Key: pr20b-pay-$TAG-$TS" \
    -d "{\"registrationId\":\"$REG\",\"amount\":\"$AMT\",\"currency\":\"IRR\"}" \
    "$WEB/api/finance/payments/manual")"
  PAY_ID="$(python3 -c 'import json; print(json.load(open("/tmp/pr20b-pay.json")).get("id",""))')"
  [[ "$PAY_CODE" == "201" && -n "$PAY_ID" ]] || return 1
  python3 - <<'PY'
from pathlib import Path
import base64
Path("/tmp/pr20b.jpg").write_bytes(base64.b64decode(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEBAVFRUVFRUVFRUVFRUWFxUXFhUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAECBQYAB//EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A1oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/Z"
))
PY
  UP_CODE="$(curl -sS -o /tmp/pr20b-up.json -w '%{http_code}' --max-time 30 \
    -H "Host: $ADMIN_HOST" -b "$JAR" \
    -H 'content-type: image/jpeg' -H 'x-receipt-file-name: pr20b.jpg' \
    --data-binary @/tmp/pr20b.jpg \
    "$WEB/api/finance/receipts/upload?registrationId=$REG")"
  FILE_KEY="$(python3 -c 'import json; print(json.load(open("/tmp/pr20b-up.json")).get("fileKey",""))')"
  [[ "$UP_CODE" == "201" && -n "$FILE_KEY" ]] || return 1
  SUB_CODE="$(curl -sS -o /tmp/pr20b-sub.json -w '%{http_code}' --max-time 30 \
    -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
    -H "Idempotency-Key: pr20b-sub-$TAG-$TS" \
    -d "{\"paymentId\":\"$PAY_ID\",\"fileKey\":\"$FILE_KEY\",\"note\":\"PR20-B $TAG $TS\"}" \
    "$WEB/api/finance/receipts")"
  RID="$(python3 -c 'import json; print(json.load(open("/tmp/pr20b-sub.json")).get("id",""))')"
  [[ "$SUB_CODE" == "201" && -n "$RID" ]] || return 1
  echo "$RID"
}

echo "== PR20-B live SoT policy tenant=$TENANT =="
curl -sS --max-time 5 "$API/health" | python3 -c 'import json,sys; assert json.load(sys.stdin).get("status")=="ok"' || fail "API"
record api_health PASS "ok"

rm -f "$JAR"
REQ="$(curl -sS -c "$JAR" -b "$JAR" --max-time 30 -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\"}" "$WEB/api/auth/request-otp")"
CH="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["challenge_id"])' <<<"$REQ")"
LOGIN="$(curl -sS -c "$JAR" -b "$JAR" --max-time 30 -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"otp\":\"$OTP\",\"challenge_id\":\"$CH\"}" "$WEB/api/auth/login-web-session")"
echo "$LOGIN" | python3 -c 'import json,sys; assert json.load(sys.stdin).get("ok") is True' || fail "login"
record login PASS "ok"

curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/bookings?limit=100" -o /tmp/pr20b-bookings.json
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/payments?limit=100" -o /tmp/pr20b-payments.json
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/receipts/pending?limit=40" -o /tmp/pr20b-pending.json

python3 - <<'PY'
import json
from pathlib import Path
bookings=json.load(open("/tmp/pr20b-bookings.json")).get("items") or []
payments=json.load(open("/tmp/pr20b-payments.json")).get("items") or []
pending=json.load(open("/tmp/pr20b-pending.json")).get("items") or []
paid_regs={(p.get("registrationId") or "") for p in payments}
pending_regs={(p.get("registrationId") or (p.get("payment") or {}).get("registrationId") or "") for p in pending}
clean=[b["id"] for b in bookings if b.get("status")=="approved" and b.get("paymentStatus")=="unpaid" and b["id"] not in paid_regs and b["id"] not in pending_regs]
Path("/tmp/pr20b-clean.json").write_text(json.dumps(clean, indent=2))
print("clean_unpaid", len(clean))
PY

mapfile -t CLEAN < <(python3 -c 'import json; print("\n".join(json.load(open("/tmp/pr20b-clean.json"))[:8]))')
echo "clean_ids=${#CLEAN[@]}"
[[ ${#CLEAN[@]} -ge 2 ]] || fail "need >=2 clean unpaid bookings; have ${#CLEAN[@]}"

# --- Scenario 1: classic underpay ---
REG_U="${CLEAN[0]}"
RID_U="$(seed_receipt "$REG_U" "1500000" "under-classic" || true)"
[[ -n "${RID_U:-}" ]] || fail "seed underpay (pay/up/sub failed — see /tmp/pr20b-*.json)"
echo "underpay reg=$REG_U receipt=$RID_U"
APPR_U="$(curl -sS -o /tmp/pr20b-appr-u.json -w '%{http_code}' --max-time 60 -X PATCH \
  -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
  -H "Idempotency-Key: pr20b-classic-u-$TS" \
  -d '{"decision":"approve","reviewNote":"PR20-B underpay classic"}' \
  "$WEB/api/finance/receipts/$RID_U/review")"
BPS_U="$(python3 -c 'import json; print(json.load(open("/tmp/pr20b-appr-u.json")).get("bookingPaymentStatus",""))')"
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/bookings/$REG_U" -o /tmp/pr20b-bk-u.json
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/invoices/$REG_U" -o /tmp/pr20b-inv-u.json
curl -sS --max-time 90 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/case/encounters/$REG_U?counterpartyId=$REG_U" -o /tmp/pr20b-enc-u.json
python3 - <<PY
import json
appr=json.load(open("/tmp/pr20b-appr-u.json"))
bk=json.load(open("/tmp/pr20b-bk-u.json"))
inv=json.load(open("/tmp/pr20b-inv-u.json"))
enc=json.load(open("/tmp/pr20b-enc-u.json"))
body=inv.get("body") or inv
bal=str(body.get("balanceDueMinor") or inv.get("balanceDueMinor") or "")
reading=(enc.get("encounter") or {}).get("reading")
pay=bk.get("paymentStatus")
detail=json.dumps({"http":"$APPR_U","bookingPaymentStatus":appr.get("bookingPaymentStatus"),"booking":pay,"balanceDueMinor":bal,"reading":reading,"reg":"$REG_U","receipt":"$RID_U"}, indent=2)
open("/tmp/pr20b-s1.json","w").write(detail)
assert "$APPR_U"=="200", detail
assert pay=="partial" and appr.get("bookingPaymentStatus")=="partial", detail
assert bal.isdigit() and int(bal)>0, detail
# Old policy false EXCEPTION was paid∩remaining; with partial that conflict cue must not fire
assert pay != "paid", detail
print(detail)
PY
record classic_underpay PASS "$(cat /tmp/pr20b-s1.json)"

# --- Scenario 2: classic full cover ---
REG_F="${CLEAN[1]}"
# Probe obligation via invoice after a $0? Use payment = prior remaining pattern: get tour price from invoice pre-pay
# Seed full amount matching typical Denali base 2500000
RID_F="$(seed_receipt "$REG_F" "2500000" "full-classic" || true)"
[[ -n "$RID_F" ]] || fail "seed full"
APPR_F="$(curl -sS -o /tmp/pr20b-appr-f.json -w '%{http_code}' --max-time 60 -X PATCH \
  -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
  -H "Idempotency-Key: pr20b-classic-f-$TS" \
  -d '{"decision":"approve","reviewNote":"PR20-B full classic"}' \
  "$WEB/api/finance/receipts/$RID_F/review")"
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/bookings/$REG_F" -o /tmp/pr20b-bk-f.json
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/invoices/$REG_F" -o /tmp/pr20b-inv-f.json
curl -sS --max-time 90 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/case/encounters/$REG_F?counterpartyId=$REG_F" -o /tmp/pr20b-enc-f.json
python3 - <<PY
import json
appr=json.load(open("/tmp/pr20b-appr-f.json"))
bk=json.load(open("/tmp/pr20b-bk-f.json"))
inv=json.load(open("/tmp/pr20b-inv-f.json"))
enc=json.load(open("/tmp/pr20b-enc-f.json"))
body=inv.get("body") or inv
bal=str(body.get("balanceDueMinor") or inv.get("balanceDueMinor") or "")
reading=(enc.get("encounter") or {}).get("reading")
pay=bk.get("paymentStatus")
detail=json.dumps({"http":"$APPR_F","bookingPaymentStatus":appr.get("bookingPaymentStatus"),"booking":pay,"balanceDueMinor":bal,"reading":reading,"reg":"$REG_F","receipt":"$RID_F"}, indent=2)
open("/tmp/pr20b-s2.json","w").write(detail)
assert "$APPR_F"=="200", detail
assert pay=="paid" and appr.get("bookingPaymentStatus")=="paid", detail
assert bal in ("0","") or int(bal or "0")==0, detail
print(detail)
PY
record classic_fullpay PASS "$(cat /tmp/pr20b-s2.json)"

# --- Scenario 3: Command UI underpay ---
REG_C="${CLEAN[2]:-${CLEAN[0]}}"
# if only 2 clean, fail needing third — try next clean
if [[ ${#CLEAN[@]} -lt 3 ]]; then
  record command_underpay SKIP "need third clean unpaid"
else
  REG_C="${CLEAN[2]}"
  RID_C="$(seed_receipt "$REG_C" "1500000" "under-cmd" || true)"
  [[ -n "$RID_C" ]] || fail "seed cmd underpay"
  ENC_CODE="$(curl -sS -o /tmp/pr20b-enc-c-before.json -w '%{http_code}' --max-time 90 \
    -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/case/encounters/$REG_C?counterpartyId=$REG_C")"
  [[ "$ENC_CODE" == "200" ]] || fail "encounter before cmd"
  EXEC1="$(python3 -c 'import json; print(json.load(open("/tmp/pr20b-enc-c-before.json"))["executionId"])')"
  FP="$(python3 -c 'import json; print(json.load(open("/tmp/pr20b-enc-c-before.json")).get("meaningFingerprint") or "")')"
  CASE_KEY="$(python3 -c 'import json; print(json.load(open("/tmp/pr20b-enc-c-before.json"))["encounter"]["caseKey"])')"
  BODY="$(python3 - <<PY
import json
fp="$FP"
body={
  "caseKey":"$CASE_KEY",
  "action":{"command":"reviewReceipt","token":"approve_evidence","decision":"approve"},
  "source":{"encounterExecutionId":"$EXEC1"},
  "correlationId":"pr20b-cmd-$TS",
  "reviewReceipt":{"registrationId":"$REG_C","counterpartyId":"$REG_C","receiptId":"$RID_C"},
}
if fp:
  body["source"]["meaningFingerprint"]=fp
print(json.dumps(body))
PY
)"
  CMD_CODE="$(curl -sS -o /tmp/pr20b-cmd.json -w '%{http_code}' --max-time 90 \
    -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
    -H "Idempotency-Key: pr20b-cmd-$TS" \
    -d "$BODY" \
    "$WEB/api/finance/case/commands/review-receipt")"
  curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/bookings/$REG_C" -o /tmp/pr20b-bk-c.json
  curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/invoices/$REG_C" -o /tmp/pr20b-inv-c.json
  curl -sS --max-time 90 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/case/encounters/$REG_C?counterpartyId=$REG_C" -o /tmp/pr20b-enc-c-after.json
  python3 - <<PY
import json
cmd=json.load(open("/tmp/pr20b-cmd.json"))
bk=json.load(open("/tmp/pr20b-bk-c.json"))
inv=json.load(open("/tmp/pr20b-inv-c.json"))
enc=json.load(open("/tmp/pr20b-enc-c-after.json"))
body=inv.get("body") or inv
bal=str(body.get("balanceDueMinor") or inv.get("balanceDueMinor") or "")
reading=(enc.get("encounter") or {}).get("reading")
pay=bk.get("paymentStatus")
detail=json.dumps({"http":"$CMD_CODE","booking":pay,"balanceDueMinor":bal,"reading":reading,"reg":"$REG_C","receipt":"$RID_C","cmdKeys":list(cmd.keys())[:12]}, indent=2)
open("/tmp/pr20b-s3.json","w").write(detail)
assert "$CMD_CODE"=="200", detail
assert pay=="partial", detail
assert bal.isdigit() and int(bal)>0, detail
print(detail)
PY
  record command_underpay PASS "$(cat /tmp/pr20b-s3.json)"
fi

# --- Safety: auth 401 ---
AUTH_CODE="$(curl -sS -o /tmp/pr20b-auth.json -w '%{http_code}' --max-time 30 \
  -H "Host: $ADMIN_HOST" -H 'authorization: Bearer invalid' -H 'content-type: application/json' \
  -d '{}' "$WEB/api/finance/case/commands/review-receipt" || echo 000)"
[[ "$AUTH_CODE" == "401" || "$AUTH_CODE" == "403" ]] || fail "auth expected 401/403 got $AUTH_CODE"
record auth PASS "http=$AUTH_CODE"

# --- Safety: stale (classic then old command) if we have another clean ---
if [[ ${#CLEAN[@]} -ge 4 ]]; then
  REG_S="${CLEAN[3]}"
  RID_S="$(seed_receipt "$REG_S" "1500000" "stale" || true)"
  if [[ -n "$RID_S" ]]; then
    ENC_S="$(curl -sS -o /tmp/pr20b-enc-s.json -w '%{http_code}' --max-time 90 \
      -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/case/encounters/$REG_S?counterpartyId=$REG_S")"
    EXEC_S="$(python3 -c 'import json; print(json.load(open("/tmp/pr20b-enc-s.json"))["executionId"])')"
    CASE_S="$(python3 -c 'import json; print(json.load(open("/tmp/pr20b-enc-s.json"))["encounter"]["caseKey"])')"
    FP_S="$(python3 -c 'import json; print(json.load(open("/tmp/pr20b-enc-s.json")).get("meaningFingerprint") or "")')"
    curl -sS -o /tmp/pr20b-classic-s.json -w '%{http_code}' --max-time 60 -X PATCH \
      -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
      -H "Idempotency-Key: pr20b-stale-classic-$TS" \
      -d '{"decision":"approve","reviewNote":"PR20-B stale classic"}' \
      "$WEB/api/finance/receipts/$RID_S/review" >/tmp/pr20b-classic-s.code
    BODY_S="$(python3 - <<PY
import json
fp="$FP_S"
body={
  "caseKey":"$CASE_S",
  "action":{"command":"reviewReceipt","token":"approve_evidence","decision":"approve"},
  "source":{"encounterExecutionId":"$EXEC_S"},
  "correlationId":"pr20b-stale-$TS",
  "reviewReceipt":{"registrationId":"$REG_S","counterpartyId":"$REG_S","receiptId":"$RID_S"},
}
if fp: body["source"]["meaningFingerprint"]=fp
print(json.dumps(body))
PY
)"
    STALE_CODE="$(curl -sS -o /tmp/pr20b-stale.json -w '%{http_code}' --max-time 60 \
      -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
      -H "Idempotency-Key: pr20b-stale-cmd-$TS" \
      -d "$BODY_S" \
      "$WEB/api/finance/case/commands/review-receipt")"
    ERR="$(python3 -c 'import json; d=json.load(open("/tmp/pr20b-stale.json")); print(d.get("error") or d.get("code") or d.get("errorCode") or "")' 2>/dev/null || true)"
    [[ "$STALE_CODE" == "409" ]] || fail "stale expected 409 got $STALE_CODE $ERR"
    record stale PASS "http=$STALE_CODE err=$ERR"
  else
    record stale SKIP "seed failed"
  fi
else
  record stale SKIP "insufficient clean bookings"
fi

python3 - <<'PY'
import json
from pathlib import Path
data=json.load(open("/tmp/pr20b-live-validation.json"))
s1=json.loads(Path("/tmp/pr20b-s1.json").read_text()) if Path("/tmp/pr20b-s1.json").exists() else {}
s2=json.loads(Path("/tmp/pr20b-s2.json").read_text()) if Path("/tmp/pr20b-s2.json").exists() else {}
s3=json.loads(Path("/tmp/pr20b-s3.json").read_text()) if Path("/tmp/pr20b-s3.json").exists() else {}
# Expansion: SoT fixed + underpay not false paid/EXCEPTION conflict; keep single tenant
under_ok = s1.get("booking")=="partial" and int(s1.get("balanceDueMinor") or 0)>0
full_ok = s2.get("booking")=="paid" and int(s2.get("balanceDueMinor") or 0)==0
# Case: underpay should not be paid∩remaining EXCEPTION
under_reading = s1.get("reading")
false_exception = under_reading=="EXCEPTION" and s1.get("booking")=="paid"
rec = "CONTINUE" if under_ok and full_ok and not false_exception else "HOLD"
if under_ok and full_ok and s1.get("reading") not in (None,"") and s2.get("reading") in ("SETTLED_CAPTURED","SETTLED","SETTLED_CAPTURED"):
  # still not READY without broader health window / architect YES
  rec = "CONTINUE"
data["recommendation"]={"status":"INFO","detail":rec,"underpay":s1,"fullpay":s2,"command":s3}
open("/tmp/pr20b-live-validation.json","w").write(json.dumps(data, indent=2))
print("RECOMMENDATION", rec)
print("under", s1.get("reading"), "full", s2.get("reading"))
PY

echo "PR20B_LIVE_OK"
cat "$OUT"
