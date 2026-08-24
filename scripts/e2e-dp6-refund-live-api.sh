#!/usr/bin/env bash
# DP-6 live refund E2E via API bearer (Wave B tenant 014 path).
set -euo pipefail
ADMIN_HOST="${ADMIN_HOST:-denali.admin.localhost}"
API="${API:-http://127.0.0.1:3001}"
PHONE="${SMOKE_OPERATOR_PHONE:-+15550001001}"
OTP="${SMOKE_OPERATOR_OTP:-1234}"
TOUR="${DP6_TOUR_ID:-00000000-0000-4000-8000-000000000901}"
TS="$(date -u +%Y%m%dT%H%M%S)"
TOKEN="${OP_TOKEN:-}"

auth_hdr() { echo "Authorization: Bearer $TOKEN"; }

if [[ -z "$TOKEN" ]]; then
  local_req="$(curl -sf -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
    -d "{\"phone\":\"$PHONE\"}" "$API/auth/request-otp")"
  ch="$(echo "$local_req" | jq -r '.challengeId // .challenge_id')"
  TOKEN="$(curl -sf -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
    -d "{\"phone\":\"$PHONE\",\"otp\":\"$OTP\",\"challengeId\":\"$ch\"}" \
    "$API/auth/verify-otp" | jq -r '.sessionToken')"
fi

seed_paid_payment() {
  local REG="$1" AMT="$2" TAG="$3"
  curl -sf -H "Host: $ADMIN_HOST" -H "$(auth_hdr)" -H 'content-type: application/json' \
    -H "Idempotency-Key: dp6-pay-$TAG-$TS" \
    -d "{\"registrationId\":\"$REG\",\"amount\":\"$AMT\",\"currency\":\"IRR\"}" \
    "$API/finance/payments/manual" > /tmp/dp6-pay.json
  PAY_ID="$(jq -r '.id' /tmp/dp6-pay.json)"
  python3 - <<'PY'
from pathlib import Path
import base64
Path("/tmp/dp6.jpg").write_bytes(base64.b64decode(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEBAVFRUVFRUVFRUVFRUWFxUXFhUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAECBQYAB//EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A1oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/Z"
))
PY
  curl -sf -H "Host: $ADMIN_HOST" -H "$(auth_hdr)" \
    -H 'content-type: image/jpeg' -H 'x-receipt-file-name: dp6.jpg' \
    --data-binary @/tmp/dp6.jpg \
    "$API/finance/receipts/upload?registrationId=$REG" > /tmp/dp6-up.json
  FILE_KEY="$(jq -r '.fileKey' /tmp/dp6-up.json)"
  curl -sf -H "Host: $ADMIN_HOST" -H "$(auth_hdr)" -H 'content-type: application/json' \
    -H "Idempotency-Key: dp6-sub-$TAG-$TS" \
    -d "{\"paymentId\":\"$(jq -r '.id' /tmp/dp6-pay.json)\",\"fileKey\":\"$FILE_KEY\",\"note\":\"DP6 api $TAG\"}" \
    "$API/finance/receipts" > /tmp/dp6-sub.json
  RID="$(jq -r '.id' /tmp/dp6-sub.json)"
  curl -sf -X PATCH -H "Host: $ADMIN_HOST" -H "$(auth_hdr)" -H 'content-type: application/json' \
    -H "Idempotency-Key: dp6-appr-$TAG-$TS" \
    -d '{"decision":"approve","reviewNote":"DP6 api paid"}' \
    "$API/finance/receipts/$RID/review" > /tmp/dp6-appr.json
}

echo "=== DP-6 API live refund E2E ==="
BODY=$(jq -n --arg t "$TOUR" '{tourId:$t,tourTitle:"DP6 Refund Live",guestLabel:"DP6 Paid Guest",guestEmail:"dp6-paid@example.com",guestPhone:"+15550006666",partySize:1,departureAt:"2031-09-01T10:00:00.000Z",registrationIntake:{tourCapacityMax:20}}')
BID=$(curl -sf -H "Host: $ADMIN_HOST" -H "$(auth_hdr)" -H 'content-type: application/json' \
  -X POST "$API/bookings" -d "$BODY" | jq -r '.id')
curl -sf -H "Host: $ADMIN_HOST" -H "$(auth_hdr)" -H 'content-type: application/json' \
  -X POST "$API/bookings/$BID/approve" -d '{}' | jq .
seed_paid_payment "$BID" "2500000" "full"
curl -sf -H "Host: $ADMIN_HOST" -H "$(auth_hdr)" "$API/bookings/$BID/refund-eligibility" | jq .
curl -sf -H "Host: $ADMIN_HOST" -H "$(auth_hdr)" -H 'content-type: application/json' \
  -X POST "$API/bookings/$BID/cancel" -d '{}' | jq .
REFUNDS=$(curl -sf -H "Host: $ADMIN_HOST" -H "$(auth_hdr)" "$API/finance/refunds?registrationId=$BID")
echo "$REFUNDS" | jq .
COUNT=$(echo "$REFUNDS" | jq '[.items[]? | select(.status=="Requested")] | length')
test "$COUNT" -ge 1 && echo "ASSERT refund draft Requested PASS"
echo "DP6_LIVE_E2E_COMPLETE"
