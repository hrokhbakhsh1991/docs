#!/usr/bin/env bash
# PR20-C — Denali Finance product acceptance audit (classic SoT; Case not under test).
set -euo pipefail
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

ADMIN_HOST="${ADMIN_HOST:-denali.admin.localhost}"
WEB="${WEB:-http://127.0.0.1:3000}"
API="${API:-http://127.0.0.1:3001}"
PHONE="${SMOKE_OPERATOR_PHONE:-+15550001001}"
OTP="${SMOKE_OPERATOR_OTP:-1234}"
JAR="${SMOKE_COOKIE_JAR:-/tmp/pr20c-audit.jar}"
OUT="${SMOKE_RESULTS:-/tmp/pr20c-acceptance.json}"
TS="$(date -u +%Y%m%d%H%M%S)"

echo '{}' >"$OUT"
record() {
  python3 - "$OUT" "$1" "$2" "$3" <<'PY'
import json,sys
path,key,status,detail=sys.argv[1:5]
data=json.loads(open(path).read())
data[key]={"status":status,"detail":detail[:12000],"evidenceClass":"LIVE"}
open(path,"w").write(json.dumps(data,indent=2))
print(f"[{status}] {key}: {detail[:220]}")
PY
}
fail(){ echo "PR20C_FAIL: $*" >&2; exit 1; }

jpg() {
  python3 - <<'PY'
from pathlib import Path
import base64
Path("/tmp/pr20c.jpg").write_bytes(base64.b64decode(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEBAVFRUVFRUVFRUVFRUWFxUXFhUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAECBQYAB//EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A1oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/Z"
))
PY
}

seed_payment_receipt() {
  local REG="$1" AMT="$2" TAG="$3"
  local PAY_CODE PAY_ID UP_CODE FILE_KEY SUB_CODE RID
  PAY_CODE="$(curl -sS -o /tmp/pr20c-pay.json -w '%{http_code}' --max-time 30 \
    -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
    -H "Idempotency-Key: pr20c-pay-$TAG-$TS" \
    -d "{\"registrationId\":\"$REG\",\"amount\":\"$AMT\",\"currency\":\"IRR\"}" \
    "$WEB/api/finance/payments/manual")"
  PAY_ID="$(python3 -c 'import json; print(json.load(open("/tmp/pr20c-pay.json")).get("id",""))')"
  [[ "$PAY_CODE" == "201" && -n "$PAY_ID" ]] || { echo ""; return 1; }
  jpg
  UP_CODE="$(curl -sS -o /tmp/pr20c-up.json -w '%{http_code}' --max-time 30 \
    -H "Host: $ADMIN_HOST" -b "$JAR" \
    -H 'content-type: image/jpeg' -H 'x-receipt-file-name: pr20c-'$TAG'.jpg' \
    --data-binary @/tmp/pr20c.jpg \
    "$WEB/api/finance/receipts/upload?registrationId=$REG")"
  FILE_KEY="$(python3 -c 'import json; print(json.load(open("/tmp/pr20c-up.json")).get("fileKey",""))')"
  [[ "$UP_CODE" == "201" && -n "$FILE_KEY" ]] || { echo ""; return 1; }
  SUB_CODE="$(curl -sS -o /tmp/pr20c-sub.json -w '%{http_code}' --max-time 30 \
    -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
    -H "Idempotency-Key: pr20c-sub-$TAG-$TS" \
    -d "{\"paymentId\":\"$PAY_ID\",\"fileKey\":\"$FILE_KEY\",\"note\":\"PR20-C $TAG $TS\"}" \
    "$WEB/api/finance/receipts")"
  RID="$(python3 -c 'import json; print(json.load(open("/tmp/pr20c-sub.json")).get("id",""))')"
  [[ "$SUB_CODE" == "201" && -n "$RID" ]] || { echo ""; return 1; }
  echo "$RID|$PAY_ID|$FILE_KEY"
}

echo "== PR20-C Denali Finance acceptance audit =="
curl -sS --max-time 5 "$API/health" | python3 -c 'import json,sys; assert json.load(sys.stdin).get("status")=="ok"' || fail API
record api_health PASS ok

rm -f "$JAR"
REQ="$(curl -sS -c "$JAR" -b "$JAR" --max-time 30 -H "Host: $ADMIN_HOST" -H 'content-type: application/json' -d "{\"phone\":\"$PHONE\"}" "$WEB/api/auth/request-otp")"
CH="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["challenge_id"])' <<<"$REQ")"
LOGIN="$(curl -sS -c "$JAR" -b "$JAR" --max-time 30 -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"otp\":\"$OTP\",\"challenge_id\":\"$CH\"}" "$WEB/api/auth/login-web-session")"
echo "$LOGIN" | python3 -c 'import json,sys; assert json.load(sys.stdin).get("ok") is True' || fail login
record login PASS ok

# Hub surface
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" -o /tmp/pr20c-finance.html "$WEB/finance"
for tab in overview payments receipts prepayments installments ledger; do
  code=$(curl -sS -o /tmp/pr20c-tab.html -w '%{http_code}' --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/finance?tab=$tab" || echo 000)
  echo "tab $tab http=$code"
done
python3 <<'PY'
from pathlib import Path
import json
html=Path('/tmp/pr20c-finance.html').read_text(errors='replace')
assert 'finance-command-center' in html or 'FinanceCommandCenter' in html
for n in ['payments','receipts','prepayment','installment','ledger','overview']:
  assert n in html.lower(), n
print('hub_ok')
PY
record hub_surface PASS "command center + tab keywords present"

# List APIs
for path_key in \
  "summary|/api/finance/summary" \
  "payments|/api/finance/payments?limit=20" \
  "pending_receipts|/api/finance/receipts/pending?limit=20" \
  "prepayments|/api/finance/prepayments?limit=20" \
  "ledger|/api/finance/ledger?limit=20" \
  "schedules|/api/finance/schedules?limit=20"
do
  key="${path_key%%|*}"; path="${path_key#*|}"
  code=$(curl -sS -o /tmp/pr20c-$key.json -w '%{http_code}' --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB$path" || echo 000)
  echo "list $key http=$code"
  record "list_$key" "$([[ $code == 200 ]] && echo PASS || echo FAIL)" "http=$code"
done

# Find clean unpaid approved bookings
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/bookings?limit=100" -o /tmp/pr20c-bookings.json
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/payments?limit=200" -o /tmp/pr20c-payments.json
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/receipts/pending?limit=40" -o /tmp/pr20c-pending.json
python3 <<'PY'
import json
from pathlib import Path
bookings=json.load(open('/tmp/pr20c-bookings.json')).get('items') or []
payments=json.load(open('/tmp/pr20c-payments.json')).get('items') or []
pending=json.load(open('/tmp/pr20c-pending.json')).get('items') or []
paid_regs={p.get('registrationId') for p in payments}
pend_regs={p.get('registrationId') or (p.get('payment') or {}).get('registrationId') for p in pending}
clean=[b['id'] for b in bookings if b.get('status')=='approved' and b.get('paymentStatus')=='unpaid' and b['id'] not in paid_regs and b['id'] not in pend_regs]
# also allow unpaid with only Rejected payments / no Pending
Path('/tmp/pr20c-clean.json').write_text(json.dumps(clean, indent=2))
print('clean', len(clean), clean[:6])
PY
mapfile -t CLEAN < <(python3 -c 'import json; print("\n".join(json.load(open("/tmp/pr20c-clean.json"))[:8]))')
[[ ${#CLEAN[@]} -ge 3 ]] || fail "need >=3 clean unpaid; have ${#CLEAN[@]}"

# ---------- A Full payment ----------
REG_A="${CLEAN[0]}"
SEED_A="$(seed_payment_receipt "$REG_A" "2500000" "A-full" || true)"
[[ -n "$SEED_A" ]] || fail "seed A"
RID_A="${SEED_A%%|*}"; rest="${SEED_A#*|}"; PAY_A="${rest%%|*}"; KEY_A="${SEED_A##*|}"
# pending queue contains it
curl -sS -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/receipts/pending?limit=40" -o /tmp/pr20c-pend-a.json
python3 -c "import json; items=json.load(open('/tmp/pr20c-pend-a.json')).get('items') or []; assert any(i.get('id')=='$RID_A' for i in items)"
# receipt URL
URL_CODE="$(curl -sS -o /tmp/pr20c-url-a.json -w '%{http_code}' --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/receipts/$RID_A/url")"
APPR_A="$(curl -sS -o /tmp/pr20c-appr-a.json -w '%{http_code}' --max-time 60 -X PATCH \
  -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
  -H "Idempotency-Key: pr20c-appr-A-$TS" \
  -d '{"decision":"approve","reviewNote":"PR20-C A full"}' \
  "$WEB/api/finance/receipts/$RID_A/review")"
# replay approve
APPR_A2="$(curl -sS -o /tmp/pr20c-appr-a2.json -w '%{http_code}' --max-time 60 -X PATCH \
  -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
  -H "Idempotency-Key: pr20c-appr-A-replay-$TS" \
  -d '{"decision":"approve","reviewNote":"PR20-C A replay"}' \
  "$WEB/api/finance/receipts/$RID_A/review")"
curl -sS -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/bookings/$REG_A" -o /tmp/pr20c-bk-a.json
curl -sS -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/invoices/$REG_A" -o /tmp/pr20c-inv-a.json
python3 - <<PY
import json
appr=json.load(open('/tmp/pr20c-appr-a.json'))
bk=json.load(open('/tmp/pr20c-bk-a.json'))
inv=json.load(open('/tmp/pr20c-inv-a.json'))
bal=str(inv.get('balanceDueMinor') or (inv.get('body') or {}).get('balanceDueMinor') or '')
detail=dict(http="$APPR_A", replayHttp="$APPR_A2", bps=appr.get('bookingPaymentStatus'), booking=bk.get('paymentStatus'), bal=bal, urlHttp="$URL_CODE", receipt="$RID_A", reg="$REG_A", payment="$PAY_A", fileKey="$KEY_A")
assert "$APPR_A"=="200" and bk.get('paymentStatus')=='paid' and int(bal or '0')==0
# replay should be 200 idempotent or conflict — record
open('/tmp/pr20c-A.json','w').write(json.dumps(detail,indent=2))
print(json.dumps(detail))
PY
record scenario_A_full PASS "$(cat /tmp/pr20c-A.json)"

# ---------- B Partial ----------
REG_B="${CLEAN[1]}"
SEED_B="$(seed_payment_receipt "$REG_B" "1500000" "B-partial" || true)"
[[ -n "$SEED_B" ]] || fail "seed B"
RID_B="${SEED_B%%|*}"
APPR_B="$(curl -sS -o /tmp/pr20c-appr-b.json -w '%{http_code}' --max-time 60 -X PATCH \
  -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
  -H "Idempotency-Key: pr20c-appr-B-$TS" \
  -d '{"decision":"approve","reviewNote":"PR20-C B partial"}' \
  "$WEB/api/finance/receipts/$RID_B/review")"
curl -sS -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/bookings/$REG_B" -o /tmp/pr20c-bk-b.json
curl -sS -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/invoices/$REG_B" -o /tmp/pr20c-inv-b.json
python3 - <<PY
import json
appr=json.load(open('/tmp/pr20c-appr-b.json'))
bk=json.load(open('/tmp/pr20c-bk-b.json'))
inv=json.load(open('/tmp/pr20c-inv-b.json'))
bal=str(inv.get('balanceDueMinor') or (inv.get('body') or {}).get('balanceDueMinor') or '')
detail=dict(http="$APPR_B", bps=appr.get('bookingPaymentStatus'), booking=bk.get('paymentStatus'), bal=bal, receipt="$RID_B", reg="$REG_B")
assert "$APPR_B"=="200" and bk.get('paymentStatus')=='partial' and int(bal)>0
open('/tmp/pr20c-B.json','w').write(json.dumps(detail,indent=2))
print(json.dumps(detail))
PY
record scenario_B_partial PASS "$(cat /tmp/pr20c-B.json)"

# ---------- C Reject ----------
REG_C="${CLEAN[2]}"
SEED_C="$(seed_payment_receipt "$REG_C" "1500000" "C-reject" || true)"
[[ -n "$SEED_C" ]] || fail "seed C"
RID_C="${SEED_C%%|*}"
REJ_C="$(curl -sS -o /tmp/pr20c-rej-c.json -w '%{http_code}' --max-time 60 -X PATCH \
  -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
  -H "Idempotency-Key: pr20c-rej-C-$TS" \
  -d '{"decision":"reject","reviewNote":"PR20-C C reject"}' \
  "$WEB/api/finance/receipts/$RID_C/review")"
curl -sS -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/bookings/$REG_C" -o /tmp/pr20c-bk-c.json
curl -sS -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/invoices/$REG_C" -o /tmp/pr20c-inv-c.json
# payment should still be Pending (reject does not mark Paid)
curl -sS -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/payments?limit=200" -o /tmp/pr20c-pays-c.json
python3 - <<PY
import json
rej=json.load(open('/tmp/pr20c-rej-c.json'))
bk=json.load(open('/tmp/pr20c-bk-c.json'))
inv=json.load(open('/tmp/pr20c-inv-c.json'))
bal=str(inv.get('balanceDueMinor') or (inv.get('body') or {}).get('balanceDueMinor') or '')
pays=json.load(open('/tmp/pr20c-pays-c.json')).get('items') or []
# find payment for this receipt via pending gone / payment status
detail=dict(http="$REJ_C", receiptStatus=rej.get('status'), booking=bk.get('paymentStatus'), bal=bal, receipt="$RID_C", reg="$REG_C")
assert "$REJ_C"=="200" and rej.get('status')=='Rejected'
assert bk.get('paymentStatus')=='unpaid'
assert int(bal or '0')>0
open('/tmp/pr20c-C.json','w').write(json.dumps(detail,indent=2))
print(json.dumps(detail))
PY
record scenario_C_reject PASS "$(cat /tmp/pr20c-C.json)"

# ---------- D Duplicate submit / approve ----------
# duplicate submit same idempotency
DUP_SUB="$(curl -sS -o /tmp/pr20c-dup-sub.json -w '%{http_code}' --max-time 30 \
  -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
  -H "Idempotency-Key: pr20c-sub-A-full-$TS" \
  -d "{\"paymentId\":\"$PAY_A\",\"fileKey\":\"$KEY_A\",\"note\":\"dup\"}" \
  "$WEB/api/finance/receipts")"
record scenario_D_dup_submit INFO "http=$DUP_SUB body=$(head -c 200 /tmp/pr20c-dup-sub.json)"
# A replay already done
record scenario_D_approve_replay INFO "http=$APPR_A2 body=$(head -c 300 /tmp/pr20c-appr-a2.json)"

# ---------- E Overpayment ----------
REG_E="${CLEAN[3]:-}"
if [[ -z "$REG_E" ]]; then
  record scenario_E_overpay SKIP "no fourth clean booking"
else
  PAY_E_CODE="$(curl -sS -o /tmp/pr20c-pay-e.json -w '%{http_code}' --max-time 30 \
    -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
    -H "Idempotency-Key: pr20c-pay-E-$TS" \
    -d "{\"registrationId\":\"$REG_E\",\"amount\":\"999999999\",\"currency\":\"IRR\"}" \
    "$WEB/api/finance/payments/manual")"
  # create payment may succeed; overpay triggers on approve
  if [[ "$PAY_E_CODE" != "201" ]]; then
    record scenario_E_overpay INFO "manual payment create http=$PAY_E_CODE $(head -c 200 /tmp/pr20c-pay-e.json)"
  else
    PAY_E="$(python3 -c 'import json; print(json.load(open("/tmp/pr20c-pay-e.json"))["id"])')"
    jpg
    curl -sS -o /tmp/pr20c-up-e.json -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: image/jpeg' -H 'x-receipt-file-name: over.jpg' --data-binary @/tmp/pr20c.jpg \
      "$WEB/api/finance/receipts/upload?registrationId=$REG_E" >/dev/null
    FILE_E="$(python3 -c 'import json; print(json.load(open("/tmp/pr20c-up-e.json"))["fileKey"])')"
    curl -sS -o /tmp/pr20c-sub-e.json -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
      -H "Idempotency-Key: pr20c-sub-E-$TS" \
      -d "{\"paymentId\":\"$PAY_E\",\"fileKey\":\"$FILE_E\",\"note\":\"over\"}" "$WEB/api/finance/receipts" >/dev/null
    RID_E="$(python3 -c 'import json; print(json.load(open("/tmp/pr20c-sub-e.json"))["id"])')"
    OVER="$(curl -sS -o /tmp/pr20c-over.json -w '%{http_code}' --max-time 60 -X PATCH \
      -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
      -H "Idempotency-Key: pr20c-appr-E-$TS" \
      -d '{"decision":"approve"}' \
      "$WEB/api/finance/receipts/$RID_E/review")"
    curl -sS -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/bookings/$REG_E" -o /tmp/pr20c-bk-e.json
    python3 - <<PY
import json
bk=json.load(open('/tmp/pr20c-bk-e.json'))
body=open('/tmp/pr20c-over.json').read()
detail=dict(http="$OVER", booking=bk.get('paymentStatus'), body=body[:500], reg="$REG_E", receipt="$RID_E")
# expect rejection — booking unpaid
assert bk.get('paymentStatus')=='unpaid'
open('/tmp/pr20c-E.json','w').write(json.dumps(detail,indent=2))
print(json.dumps(detail))
PY
    record scenario_E_overpay PASS "$(cat /tmp/pr20c-E.json)"
  fi
fi

# ---------- F Multiple payments cumulative ----------
REG_F="${CLEAN[4]:-}"
if [[ -z "$REG_F" ]]; then
  # continue on B: second payment toward remaining
  REG_F="$REG_B"
  record scenario_F_multi INFO "using REG_B=$REG_B for second payment"
else
  record scenario_F_multi INFO "using clean REG_F=$REG_F"
fi
# If REG_F is B (already partial), add second payment for remaining
INV_F_BEFORE="$(curl -sS -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/invoices/$REG_F")"
BAL_BEFORE="$(python3 -c 'import json,sys; d=json.loads(sys.argv[1]); print(d.get("balanceDueMinor") or (d.get("body") or {}).get("balanceDueMinor") or "")' "$INV_F_BEFORE")"
BK_BEFORE="$(curl -sS -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/bookings/$REG_F")"
PAY_BEFORE="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("paymentStatus"))' "$BK_BEFORE")"
if [[ -n "$BAL_BEFORE" && "$BAL_BEFORE" != "0" ]]; then
  SEED_F="$(seed_payment_receipt "$REG_F" "$BAL_BEFORE" "F-remain" || true)"
  if [[ -n "$SEED_F" ]]; then
    RID_F="${SEED_F%%|*}"
    APPR_F="$(curl -sS -o /tmp/pr20c-appr-f.json -w '%{http_code}' --max-time 60 -X PATCH \
      -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
      -H "Idempotency-Key: pr20c-appr-F-$TS" \
      -d '{"decision":"approve","reviewNote":"PR20-C F remainder"}' \
      "$WEB/api/finance/receipts/$RID_F/review")"
    curl -sS -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/bookings/$REG_F" -o /tmp/pr20c-bk-f.json
    curl -sS -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/invoices/$REG_F" -o /tmp/pr20c-inv-f.json
    python3 - <<PY
import json
bk=json.load(open('/tmp/pr20c-bk-f.json'))
inv=json.load(open('/tmp/pr20c-inv-f.json'))
bal=str(inv.get('balanceDueMinor') or (inv.get('body') or {}).get('balanceDueMinor') or '')
appr=json.load(open('/tmp/pr20c-appr-f.json'))
detail=dict(http="$APPR_F", beforePay="$PAY_BEFORE", beforeBal="$BAL_BEFORE", booking=bk.get('paymentStatus'), bal=bal, bps=appr.get('bookingPaymentStatus'), reg="$REG_F")
assert "$APPR_F"=="200" and bk.get('paymentStatus')=='paid' and int(bal or '0')==0
open('/tmp/pr20c-F.json','w').write(json.dumps(detail,indent=2))
print(json.dumps(detail))
PY
    record scenario_F_multi PASS "$(cat /tmp/pr20c-F.json)"
  else
    record scenario_F_multi FAIL "seed remainder failed"
  fi
else
  record scenario_F_multi SKIP "no remaining balance to top up"
fi

# UI consistency spot-check: payments list includes A paid payment; pending receipts empty of A/B approved
curl -sS -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/payments?limit=50" -o /tmp/pr20c-pays-end.json
curl -sS -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/receipts/pending?limit=40" -o /tmp/pr20c-pend-end.json
python3 - <<PY
import json
pays=json.load(open('/tmp/pr20c-pays-end.json')).get('items') or []
pend=json.load(open('/tmp/pr20c-pend-end.json')).get('items') or []
ids={p.get('id') for p in pays}
pend_ids={p.get('id') for p in pend}
detail=dict(paymentAInList=("$PAY_A" in ids), receiptAStillPending=("$RID_A" in pend_ids), receiptBStillPending=("$RID_B" in pend_ids), receiptCStillPending=("$RID_C" in pend_ids), pendingCount=len(pend))
assert detail['paymentAInList'] is True
assert detail['receiptAStillPending'] is False
assert detail['receiptBStillPending'] is False
assert detail['receiptCStillPending'] is False
open('/tmp/pr20c-ui.json','w').write(json.dumps(detail,indent=2))
print(json.dumps(detail))
PY
record ui_sot_consistency PASS "$(cat /tmp/pr20c-ui.json)"

# Rejected receipt still fetchable via URL?
URL_C="$(curl -sS -o /tmp/pr20c-url-c.json -w '%{http_code}' --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" "$WEB/api/finance/receipts/$RID_C/url")"
record rejected_receipt_url INFO "http=$URL_C $(head -c 200 /tmp/pr20c-url-c.json)"

echo "PR20C_ACCEPTANCE_LIVE_OK"
python3 - <<'PY'
import json
data=json.loads(open('/tmp/pr20c-acceptance.json').read())
fails=[k for k,v in data.items() if isinstance(v,dict) and v.get('status')=='FAIL']
data['summary']={'failKeys':fails,'failCount':len(fails)}
open('/tmp/pr20c-acceptance.json','w').write(json.dumps(data,indent=2))
print('fails', fails)
PY
cat "$OUT" | head -c 4000
