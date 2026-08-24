#!/usr/bin/env bash
# DP-6 live refund E2E via API bearer (Wave B tenant 014 path).
set -euo pipefail
ADMIN_HOST="${ADMIN_HOST:-denali.admin.localhost}"
API="${API:-http://127.0.0.1:3001}"
PHONE="${SMOKE_OPERATOR_PHONE:-+15550001001}"
OTP="${SMOKE_OPERATOR_OTP:-1234}"
TENANT_ID="${TOUR_OPS_DEV_TENANT_ID:-00000000-0000-4000-8000-000000000014}"
WORKSPACE_ID="${TOUR_OPS_DEV_WORKSPACE_ID:-ws-operator-smoke}"
TOUR="${DP6_TOUR_ID:-00000000-0000-4000-8000-000000000901}"
TS="$(date -u +%Y%m%dT%H%M%S)"
TOKEN="${OP_TOKEN:-}"

auth_hdr() { echo "Authorization: Bearer $TOKEN"; }

if [[ -z "$TOKEN" ]]; then
  ch="$(curl -sf -H "Host: $ADMIN_HOST" \
    -H "x-tenant-id: $TENANT_ID" -H "x-authenticated-tenant-id: $TENANT_ID" \
    -H "x-user-id: 00000000-0000-4000-8000-000000000099" \
    -H "x-actor-role: member" -H "x-membership-status: ACTIVE" \
    -H "x-workspace-id: $WORKSPACE_ID" \
    -H 'content-type: application/json' -d "{\"mobile\":\"$PHONE\"}" \
    "$API/auth/request-otp" | jq -r '.challengeId // .challenge_id')"
  TOKEN="$(curl -sf -H "Host: $ADMIN_HOST" \
    -H "x-tenant-id: $TENANT_ID" -H "x-authenticated-tenant-id: $TENANT_ID" \
    -H "x-user-id: 00000000-0000-4000-8000-000000000099" \
    -H "x-actor-role: member" -H "x-membership-status: ACTIVE" \
    -H "x-workspace-id: $WORKSPACE_ID" \
    -H 'content-type: application/json' \
    -d "{\"mobile\":\"$PHONE\",\"otp\":\"$OTP\",\"challengeId\":\"$ch\"}" \
    "$API/auth/verify-otp" | jq -r '.sessionToken')"
fi

seed_paid_payment() {
  local REG="$1" AMT="$2" TAG="$3"
  curl -sf -H "Host: $ADMIN_HOST" -H "$(auth_hdr)" -H 'content-type: application/json' \
    -H "Idempotency-Key: dp6-pay-$TAG-$TS" \
    -d "{\"registrationId\":\"$REG\",\"amount\":\"$AMT\",\"currency\":\"IRR\"}" \
    "$API/finance/payments/manual" > /tmp/dp6-pay.json
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
