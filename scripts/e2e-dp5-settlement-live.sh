#!/usr/bin/env bash
# DP-5 live E2E with operator session (browser-cert data seed + API proof)
set -euo pipefail
ADMIN_HOST="${ADMIN_HOST:-admin.denali.localhost}"
WEB="${WEB:-http://127.0.0.1:3000}"
API="${API:-http://127.0.0.1:3001}"
PHONE="${SMOKE_OPERATOR_PHONE:-09174070937}"
OTP="${SMOKE_OPERATOR_OTP:-1234}"
TOUR="${DP5_TOUR_ID:-00000000-0000-4000-8000-000000000214}"
UNIT="${DP5_UNIT_MINOR:-50000}"
JAR="/tmp/dp5-e2e.jar"
LOG="/opt/cursor/artifacts/dp5-e2e-live.log"
exec > >(tee "$LOG") 2>&1

echo "=== DP-5 live E2E ==="
curl -sf "$API/health" | jq .

rm -f "$JAR"
REQ=$(curl -sf -c "$JAR" -b "$JAR" -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\"}" "$WEB/api/auth/request-otp")
CH=$(echo "$REQ" | jq -r '.challenge_id')
curl -sf -c "$JAR" -b "$JAR" -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"otp\":\"$OTP\",\"challenge_id\":\"$CH\"}" "$WEB/api/auth/login-web-session" | jq .

create_booking() {
  local label="$1" kind="$2" occupants="${3:-}"
  local body
  if [ "$kind" = "personal_car" ]; then
    body=$(jq -n --arg t "$TOUR" --arg l "$label" --argjson o "$occupants" \
      '{tourId:$t,tourTitle:"DP5 Live",guestLabel:$l,guestEmail:"dp5@example.com",guestPhone:"+15550007777",partySize:1,departureAt:"2031-09-01T10:00:00.000Z",registrationIntake:{tourCapacityMax:20,transport:{kind:"personal_car",personalCarOccupants:$o}}}')
  else
    body=$(jq -n --arg t "$TOUR" --arg l "$label" \
      '{tourId:$t,tourTitle:"DP5 Live",guestLabel:$l,guestEmail:"dp5@example.com",guestPhone:"+15550007776",partySize:1,departureAt:"2031-09-01T10:00:00.000Z",registrationIntake:{tourCapacityMax:20,transport:{kind:"primary"}}}')
  fi
  local id
  id=$(curl -sf -b "$JAR" -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
    -X POST "$WEB/api/bookings" -d "$body" | jq -r '.id')
  curl -sf -b "$JAR" -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
    -X POST "$WEB/api/bookings/$id/approve" -d '{}' >/dev/null
  echo "$id"
}

DRIVER=$(create_booking "DP5 Live Driver" personal_car 3)
P1=$(create_booking "DP5 Live P1" primary)
P2=$(create_booking "DP5 Live P2" primary)
echo "driver=$DRIVER p1=$P1 p2=$P2 tour=$TOUR"

curl -sf -b "$JAR" -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -X PUT "$WEB/api/tours/$TOUR/transport-allocations" \
  -d "$(jq -n --arg d "$DRIVER" --arg p1 "$P1" --arg p2 "$P2" '{allocations:[{driverRegistrationId:$d,passengerRegistrationId:$p1},{driverRegistrationId:$d,passengerRegistrationId:$p2}]}')" | jq .

FREEZE=$(curl -sf -b "$JAR" -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -X POST "$WEB/api/tours/$TOUR/roster/freeze" \
  -d "$(jq -n --arg u "$UNIT" '{driverCompensationPerSeatMinor:$u,currency:"IRR"}')")
echo "$FREEZE" | jq .
SID=$(echo "$FREEZE" | jq -r '.settlements[0].settlementId')
TOTAL=$(echo "$FREEZE" | jq -r '.settlements[0].totalMinor')
BILLABLE=$(echo "$FREEZE" | jq -r '.settlements[0].billableQuantity')
test "$BILLABLE" = "2" && test "$TOTAL" = "100000" && echo "ASSERT 2×50000=100000 PASS"

curl -sf -b "$JAR" -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -X POST "$WEB/api/tours/$TOUR/driver-settlements/$SID/confirm" -d '{}' | jq .
PAYABLE=$(curl -sf -b "$JAR" -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -X POST "$WEB/api/tours/$TOUR/driver-settlements/$SID/approve-payable" -d '{}')
echo "$PAYABLE" | jq .
PID=$(echo "$PAYABLE" | jq -r '.payable.payableId')

curl -sf -b "$JAR" -H "Host: $ADMIN_HOST" "$WEB/api/finance/driver-payables" | jq .
curl -sf -b "$JAR" -H "Host: $ADMIN_HOST" -H 'content-type: application/json' \
  -X POST "$WEB/api/finance/driver-payables/$PID/complete" \
  -d '{"evidenceNote":"DP5 live E2E bank transfer"}' | jq .

echo "TOUR_URL=$WEB/tours/$TOUR/workspace/transport"
echo "DP5_LIVE_E2E_COMPLETE"
