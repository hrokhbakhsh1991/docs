#!/usr/bin/env bash
# DP-6 live refund orchestration E2E (operator session + Finance refund draft proof)
set -euo pipefail
ADMIN_HOST="${ADMIN_HOST:-denali.admin.localhost}"
WEB="${WEB:-http://127.0.0.1:3000}"
API="${API:-http://127.0.0.1:3001}"
PHONE="${SMOKE_OPERATOR_PHONE:-09174070937}"
OTP="${SMOKE_OPERATOR_OTP:-1234}"
TOUR="${DP6_TOUR_ID:-00000000-0000-4000-8000-000000000901}"
JAR="/tmp/dp6-e2e.jar"
LOG="/opt/cursor/artifacts/dp6-e2e-live.log"
TS="$(date -u +%Y%m%d%H%M%S)"
exec > >(tee "$LOG") 2>&1

seed_paid_payment() {
  local REG="$1" AMT="$2" TAG="$3"
  local PAY_CODE PAY_ID UP_CODE FILE_KEY SUB_CODE RID APPR_CODE
  PAY_CODE="$(curl -sS -o /tmp/dp6-pay.json -w '%{http_code}' --max-time 30 \
    -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
    -H "Idempotency-Key: dp6-pay-$TAG-$TS" \
    -d "{\"registrationId\":\"$REG\",\"amount\":\"$AMT\",\"currency\":\"IRR\"}" \
    "$WEB/api/finance/payments/manual")"
  PAY_ID="$(python3 -c 'import json; print(json.load(open("/tmp/dp6-pay.json")).get("id",""))')"
  [[ "$PAY_CODE" == "201" && -n "$PAY_ID" ]] || { echo "seed payment failed: $PAY_CODE"; cat /tmp/dp6-pay.json; return 1; }
  python3 - <<'PY'
from pathlib import Path
import base64
Path("/tmp/dp6.jpg").write_bytes(base64.b64decode(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEBAVFRUVFRUVFRUVFRUWFxUXFhUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAECBQYAB//EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A1oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/Z"
))
PY
  UP_CODE="$(curl -sS -o /tmp/dp6-up.json -w '%{http_code}' --max-time 30 \
    -H "Host: $ADMIN_HOST" -b "$JAR" \
    -H 'content-type: image/jpeg' -H 'x-receipt-file-name: dp6.jpg' \
    --data-binary @/tmp/dp6.jpg \
    "$WEB/api/finance/receipts/upload?registrationId=$REG")"
  FILE_KEY="$(python3 -c 'import json; print(json.load(open("/tmp/dp6-up.json")).get("fileKey",""))')"
  [[ "$UP_CODE" == "201" && -n "$FILE_KEY" ]] || { echo "upload failed: $UP_CODE"; return 1; }
  SUB_CODE="$(curl -sS -o /tmp/dp6-sub.json -w '%{http_code}' --max-time 30 \
    -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
    -H "Idempotency-Key: dp6-sub-$TAG-$TS" \
    -d "{\"paymentId\":\"$PAY_ID\",\"fileKey\":\"$FILE_KEY\",\"note\":\"DP6 live $TAG $TS\"}" \
    "$WEB/api/finance/receipts")"
  RID="$(python3 -c 'import json; print(json.load(open("/tmp/dp6-sub.json")).get("id",""))')"
  [[ "$SUB_CODE" == "201" && -n "$RID" ]] || { echo "submit failed: $SUB_CODE"; return 1; }
  APPR_CODE="$(curl -sS -o /tmp/dp6-appr.json -w '%{http_code}' --max-time 60 -X PATCH \
    -H "Host: $ADMIN_HOST" -b "$JAR" -H 'content-type: application/json' \
    -H "Idempotency-Key: dp6-appr-$TAG-$TS" \
    -d '{"decision":"approve","reviewNote":"DP6 live paid seed"}' \
    "$WEB/api/finance/receipts/$RID/review")"
  [[ "$APPR_CODE" == "200" ]] || { echo "approve failed: $APPR_CODE"; cat /tmp/dp6-appr.json; return 1; }
  echo "$PAY_ID"
}

echo "=== DP-6 live refund E2E ==="
curl -sf "$API/health" | jq .

rm -f "$JAR"
REQ=$(curl -sf -c "$JAR" -b "$JAR" -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\"}" "$WEB/api/auth/request-otp")
CH=$(echo "$REQ" | jq -r '.challenge_id')
curl -sf -c "$JAR" -b "$JAR" -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"otp\":\"$OTP\",\"challenge_id\":\"$CH\"}" "$WEB/api/auth/login-web-session" | jq .

BODY=$(jq -n --arg t "$TOUR" '{tourId:$t,tourTitle:"DP6 Refund Live",guestLabel:"DP6 Paid Guest",guestEmail:"dp6-paid@example.com",guestPhone:"+15550006666",partySize:1,departureAt:"2031-09-01T10:00:00.000Z",registrationIntake:{tourCapacityMax:20}}')
BID=$(curl -sf -b "$JAR" -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -X POST "$WEB/api/bookings" -d "$BODY" | jq -r '.id')
echo "booking=$BID"
curl -sf -b "$JAR" -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -X POST "$WEB/api/bookings/$BID/approve" -d '{}' | jq .

seed_paid_payment "$BID" "2500000" "full" || exit 1
curl -sf -b "$JAR" -H "Host: $ADMIN_HOST" "$WEB/api/bookings/$BID" | jq '{id,status,paymentStatus}'

ELIG=$(curl -sf -b "$JAR" -H "Host: $ADMIN_HOST" "$API/bookings/$BID/refund-eligibility")
echo "eligibility:"; echo "$ELIG" | jq .

curl -sf -b "$JAR" -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -X POST "$WEB/api/bookings/$BID/cancel" -d '{}' | jq .

REFUNDS=$(curl -sf -b "$JAR" -H "Host: $ADMIN_HOST" "$WEB/api/finance/refunds?registrationId=$BID")
echo "refunds:"; echo "$REFUNDS" | jq .
COUNT=$(echo "$REFUNDS" | jq '[.items[]? | select(.status=="Requested")] | length')
test "$COUNT" -ge 1 && echo "ASSERT refund draft Requested PASS"

echo "FINANCE_URL=$WEB/finance?tab=refunds&registrationId=$BID"
echo "DP6_LIVE_E2E_COMPLETE"
