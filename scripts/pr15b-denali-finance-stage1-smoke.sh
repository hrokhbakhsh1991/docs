#!/usr/bin/env bash
# PR15-B — Denali finance Stage 1 live smoke (validation only).
# Does NOT enable FINANCE_CASE_* flags. Requires API :3001 + web :3000.
set -euo pipefail
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN_HOST="${ADMIN_HOST:-denali.admin.localhost}"
WEB="${WEB:-http://127.0.0.1:3000}"
API="${API:-http://127.0.0.1:3001}"
PHONE="${SMOKE_OPERATOR_PHONE:-09174070937}"
OTP="${SMOKE_OPERATOR_OTP:-1234}"
JAR="${SMOKE_COOKIE_JAR:-/tmp/pr15b-denali-smoke.jar}"
TS="$(date -u +%Y%m%d%H%M%S)"
RESULTS="${SMOKE_RESULTS:-/tmp/pr15b-stage1-smoke.json}"

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

fail() { echo "PR15B_SMOKE_FAIL: $*" >&2; exit 1; }

echo "== PR15-B Stage 1 smoke → Host=$ADMIN_HOST WEB=$WEB API=$API =="

# --- Boot / health ---
HEALTH="$(curl -sS --max-time 5 "$API/health" || true)"
echo "$HEALTH" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("status")=="ok"' \
  || fail "API health not ok: $HEALTH"
record api_health PASS "$HEALTH"

# Case flags must remain off for Stage 1 (advisory check via Encounter)
rm -f "$JAR"
REQ="$(curl -sS -c "$JAR" -b "$JAR" --max-time 30 \
  -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\"}" "$WEB/api/auth/request-otp")"
CH="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["challenge_id"])' <<<"$REQ")"
LOGIN="$(curl -sS -c "$JAR" -b "$JAR" --max-time 30 \
  -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"otp\":\"$OTP\",\"challenge_id\":\"$CH\"}" \
  "$WEB/api/auth/login-web-session")"
echo "$LOGIN" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("ok") is True' \
  || fail "login failed: $LOGIN"
TOKEN="$(awk '$6=="atour_op_session"{print $7}' "$JAR")"
[[ -n "$TOKEN" ]] || fail "missing atour_op_session cookie"

# Hub
curl -sS --max-time 60 -H "Host: $ADMIN_HOST" -b "$JAR" -o /tmp/pr15b-smoke-finance.html "$WEB/finance"
python3 - <<'PY' || fail "finance hub markers missing"
from pathlib import Path
html = Path("/tmp/pr15b-smoke-finance.html").read_text(errors="replace")
assert "finance-command-center" in html or "FinanceCommandCenter" in html
assert "مرکز مالی" in html
for tab in ("overview", "payments", "receipts", "prepayments", "installments", "ledger"):
    assert tab in html.lower(), tab
print("hub ok")
PY
record hub_loads PASS "finance-command-center + tabs present"

# Case isolation
ENC="$(curl -sS -o /tmp/pr15b-smoke-enc.json -w '%{http_code}' --max-time 20 \
  -H "Host: $ADMIN_HOST" -H "Authorization: Bearer $TOKEN" \
  "$API/finance/case/encounters/00000000-0000-4000-8000-000000000524")"
python3 - <<'PY' || fail "Encounter not disabled"
import json
from pathlib import Path
body = json.loads(Path("/tmp/pr15b-smoke-enc.json").read_text())
err = body.get("error")
code = err.get("code") if isinstance(err, dict) else body.get("code")
assert code == "CASE_ENCOUNTER_DISABLED"
assert "encounter" not in body
print(code)
PY
record case_disabled PASS "HTTP $ENC CASE_ENCOUNTER_DISABLED"

# Pick approved unpaid registration without pending payment if possible
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" \
  "$WEB/api/bookings?limit=100" -o /tmp/pr15b-smoke-bookings.json
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" \
  "$WEB/api/finance/payments?limit=50" -o /tmp/pr15b-smoke-payments.json
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" \
  "$WEB/api/finance/receipts/pending?limit=20" -o /tmp/pr15b-smoke-pending.json

python3 - <<'PY'
import json
from pathlib import Path
bookings = json.loads(Path("/tmp/pr15b-smoke-bookings.json").read_text())["items"]
pays = {p["registrationId"] for p in json.loads(Path("/tmp/pr15b-smoke-payments.json").read_text())["items"]}
pending = json.loads(Path("/tmp/pr15b-smoke-pending.json").read_text())["items"]
unpaid = [b for b in bookings if b.get("status") == "approved" and b.get("paymentStatus") == "unpaid" and b["id"] not in pays]
reg = unpaid[0]["id"] if unpaid else None
approve = pending[0]["id"] if pending else None
approve_reg = pending[0].get("registrationId") if pending else None
reject = pending[1]["id"] if len(pending) > 1 else None
Path("/tmp/pr15b-smoke-plan.json").write_text(json.dumps({
  "reg": reg, "approve": approve, "approve_reg": approve_reg, "reject": reject
}, indent=2))
print(Path("/tmp/pr15b-smoke-plan.json").read_text())
PY

REG="$(python3 -c 'import json; print(json.load(open("/tmp/pr15b-smoke-plan.json"))["reg"] or "")')"
APPROVE="$(python3 -c 'import json; print(json.load(open("/tmp/pr15b-smoke-plan.json"))["approve"] or "")')"
APPROVE_REG="$(python3 -c 'import json; print(json.load(open("/tmp/pr15b-smoke-plan.json"))["approve_reg"] or "")')"
REJECT="$(python3 -c 'import json; print(json.load(open("/tmp/pr15b-smoke-plan.json"))["reject"] or "")')"
[[ -n "$REG" ]] || fail "no approved unpaid registration without payment"
[[ -n "$APPROVE" && -n "$REJECT" ]] || fail "need ≥2 pending receipts for approve+reject"

# Manual payment
PAY_CODE="$(curl -sS -o /tmp/pr15b-smoke-pay.json -w '%{http_code}' --max-time 30 \
  -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
  -H "Idempotency-Key: pr15b-smoke-pay-$TS" \
  -d "{\"registrationId\":\"$REG\",\"amount\":\"1500000\",\"currency\":\"IRR\"}" \
  "$WEB/api/finance/payments/manual")"
PAY_ID="$(python3 -c 'import json; print(json.load(open("/tmp/pr15b-smoke-pay.json")).get("id",""))')"
[[ "$PAY_CODE" == "201" && -n "$PAY_ID" ]] || fail "manual payment failed: $PAY_CODE $(cat /tmp/pr15b-smoke-pay.json)"
record create_manual_payment PASS "http=$PAY_CODE id=$PAY_ID"

# Upload (raw image — not multipart)
python3 - <<'PY'
from pathlib import Path
import base64
Path("/tmp/pr15b-smoke.jpg").write_bytes(base64.b64decode(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEBAVFRUVFRUVFRUVFRUWFxUXFhUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAECBQYAB//EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A1oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/Z"
))
PY
UP_CODE="$(curl -sS -o /tmp/pr15b-smoke-up.json -w '%{http_code}' --max-time 30 \
  -H "Host: $ADMIN_HOST" -b "$JAR" \
  -H 'content-type: image/jpeg' -H 'x-receipt-file-name: pr15b-smoke.jpg' \
  --data-binary @/tmp/pr15b-smoke.jpg \
  "$WEB/api/finance/receipts/upload?registrationId=$REG")"
FILE_KEY="$(python3 -c 'import json; print(json.load(open("/tmp/pr15b-smoke-up.json")).get("fileKey",""))')"
[[ "$UP_CODE" == "201" && -n "$FILE_KEY" ]] || fail "upload failed: $UP_CODE $(cat /tmp/pr15b-smoke-up.json)"
record receipt_upload PASS "http=$UP_CODE fileKey=$FILE_KEY"

SUB_CODE="$(curl -sS -o /tmp/pr15b-smoke-sub.json -w '%{http_code}' --max-time 30 \
  -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
  -H "Idempotency-Key: pr15b-smoke-sub-$TS" \
  -d "{\"paymentId\":\"$PAY_ID\",\"fileKey\":\"$FILE_KEY\",\"note\":\"PR15-B smoke $TS\"}" \
  "$WEB/api/finance/receipts")"
SUB_ID="$(python3 -c 'import json; print(json.load(open("/tmp/pr15b-smoke-sub.json")).get("id",""))')"
[[ "$SUB_CODE" == "201" && -n "$SUB_ID" ]] || fail "submit failed: $SUB_CODE $(cat /tmp/pr15b-smoke-sub.json)"
record submit_receipt PASS "http=$SUB_CODE id=$SUB_ID"

# Approve + booking sync
BEFORE="$(python3 -c "import json; items=json.load(open('/tmp/pr15b-smoke-bookings.json'))['items']; print(next((b.get('paymentStatus') for b in items if b['id']=='$APPROVE_REG'),'MISSING'))")"
APPR_CODE="$(curl -sS -o /tmp/pr15b-smoke-appr.json -w '%{http_code}' --max-time 30 \
  -H "Host: $ADMIN_HOST" -b "$JAR" -X PATCH -H 'content-type: application/json' \
  -H "Idempotency-Key: pr15b-smoke-appr-$TS" \
  -d '{"decision":"approve","reviewNote":"PR15-B smoke approve"}' \
  "$WEB/api/finance/receipts/$APPROVE/review")"
[[ "$APPR_CODE" == "200" ]] || fail "approve failed: $APPR_CODE $(cat /tmp/pr15b-smoke-appr.json)"
BPS="$(python3 -c 'import json; print(json.load(open("/tmp/pr15b-smoke-appr.json")).get("bookingPaymentStatus",""))')"
curl -sS --max-time 30 -H "Host: $ADMIN_HOST" -b "$JAR" \
  "$WEB/api/bookings?limit=100" -o /tmp/pr15b-smoke-bookings-after.json
AFTER="$(python3 -c "import json; items=json.load(open('/tmp/pr15b-smoke-bookings-after.json'))['items']; print(next((b.get('paymentStatus') for b in items if b['id']=='$APPROVE_REG'),'MISSING'))")"
[[ "$BPS" == "paid" || "$AFTER" == "paid" ]] || fail "booking sync failed before=$BEFORE after=$AFTER bps=$BPS"
record review_approve PASS "http=$APPR_CODE bookingPaymentStatus=$BPS"
record booking_payment_sync PASS "reg=$APPROVE_REG before=$BEFORE after=$AFTER"

REJ_CODE="$(curl -sS -o /tmp/pr15b-smoke-rej.json -w '%{http_code}' --max-time 30 \
  -H "Host: $ADMIN_HOST" -b "$JAR" -X PATCH -H 'content-type: application/json' \
  -d '{"decision":"reject","reviewNote":"PR15-B smoke reject"}' \
  "$WEB/api/finance/receipts/$REJECT/review")"
[[ "$REJ_CODE" == "200" ]] || fail "reject failed: $REJ_CODE $(cat /tmp/pr15b-smoke-rej.json)"
record review_reject PASS "http=$REJ_CODE"

# Case still disabled after mutations
ENC2="$(curl -sS -o /tmp/pr15b-smoke-enc2.json -w '%{http_code}' --max-time 20 \
  -H "Host: $ADMIN_HOST" -H "Authorization: Bearer $TOKEN" \
  "$API/finance/case/encounters/$REG")"
python3 - <<'PY' || fail "Case executed after mutations"
import json
from pathlib import Path
raw = Path("/tmp/pr15b-smoke-enc2.json").read_text()
body = json.loads(raw)
err = body.get("error")
code = err.get("code") if isinstance(err, dict) else body.get("code")
assert code == "CASE_ENCOUNTER_DISABLED"
assert "CaseOutput" not in raw and "FactSnapshot" not in raw
print(code)
PY
record case_disabled_after PASS "HTTP $ENC2 still CASE_ENCOUNTER_DISABLED"

# Stage 2 readiness (static; does not enable pilot)
python3 - "$ROOT" <<'PY'
import sys
from pathlib import Path
root = Path(sys.argv[1])
manifest = (root / "packages/finance-http/src/routes-manifest.ts").read_text()
rollout = (root / "apps/api/src/workspace-finance/case/encounter/finance-case-encounter-rollout.ts").read_text()
assert "/finance/case/encounters/:registrationId" in manifest
assert "pilot" in rollout.lower()
print("stage2 ready")
PY
record stage2_readiness PASS "Encounter route + pilot config present; pilot NOT enabled"

echo "PR15B_STAGE1_SMOKE_OK"
echo "results: $RESULTS"
cat "$RESULTS"
