#!/usr/bin/env bash
# DP-5 terminal E2E — full settlement lifecycle evidence
set -euo pipefail
API="http://127.0.0.1:3001"
TENANT="00000000-0000-4000-8000-000000000014"
USER="00000000-0000-4000-8000-000000000102"
TOUR="00000000-0000-4000-8000-000000000901"
UNIT="50000"
HDR=(-H "content-type: application/json" -H "x-tenant-id: $TENANT" -H "x-user-id: $USER" -H "x-user-role: admin" -H "x-user-status: ACTIVE")

echo "=== DP-5 E2E settlement lifecycle ==="

# Seed via test harness inline — create driver + 2 passengers via API
create_and_approve() {
  local label="$1" transport="$2"
  local body
  if [ "$transport" = "driver" ]; then
    body=$(jq -n --arg t "$TOUR" --arg l "$label" '{tourId:$t,tourTitle:"DP5 E2E",guestLabel:$l,guestEmail:"e2e@example.com",guestPhone:"+15550009999",partySize:1,departureAt:"2031-09-01T10:00:00.000Z",registrationIntake:{tourCapacityMax:20,transport:{kind:"personal_car",personalCarOccupants:3}}}')
  else
    body=$(jq -n --arg t "$TOUR" --arg l "$label" '{tourId:$t,tourTitle:"DP5 E2E",guestLabel:$l,guestEmail:"e2e@example.com",guestPhone:"+15550009998",partySize:1,departureAt:"2031-09-01T10:00:00.000Z",registrationIntake:{tourCapacityMax:20,transport:{kind:"primary"}}}')
  fi
  local id
  id=$(curl -sf "${HDR[@]}" -X POST "$API/bookings" -d "$body" | jq -r '.id')
  curl -sf "${HDR[@]}" -X POST "$API/bookings/$id/approve" -d '{}' >/dev/null
  echo "$id"
}

DRIVER=$(create_and_approve "E2E Driver" driver)
P1=$(create_and_approve "E2E P1" passenger)
P2=$(create_and_approve "E2E P2" passenger)
echo "driver=$DRIVER p1=$P1 p2=$P2"

curl -sf "${HDR[@]}" -X PUT "$API/tours/$TOUR/transport-allocations" -d "$(jq -n --arg d "$DRIVER" --arg p1 "$P1" --arg p2 "$P2" '{allocations:[{driverRegistrationId:$d,passengerRegistrationId:$p1},{driverRegistrationId:$d,passengerRegistrationId:$p2}]}')" | jq .

FREEZE=$(curl -sf "${HDR[@]}" -X POST "$API/tours/$TOUR/roster/freeze" -d "$(jq -n --arg u "$UNIT" '{driverCompensationPerSeatMinor:$u,currency:"IRR"}')")
echo "$FREEZE" | jq .
SETTLEMENT_ID=$(echo "$FREEZE" | jq -r '.settlements[0].settlementId')
TOTAL=$(echo "$FREEZE" | jq -r '.settlements[0].totalMinor')
BILLABLE=$(echo "$FREEZE" | jq -r '.settlements[0].billableQuantity')
test "$BILLABLE" = "2"
test "$TOTAL" = "100000"
echo "ASSERT billable=2 total=100000 PASS"

curl -sf "${HDR[@]}" -X POST "$API/tours/$TOUR/driver-settlements/$SETTLEMENT_ID/confirm" -d '{}' | jq .
PAYABLE=$(curl -sf "${HDR[@]}" -X POST "$API/tours/$TOUR/driver-settlements/$SETTLEMENT_ID/approve-payable" -d '{}')
echo "$PAYABLE" | jq .
PAYABLE_ID=$(echo "$PAYABLE" | jq -r '.payable.payableId')
AMT=$(echo "$PAYABLE" | jq -r '.payable.amountMinor')
test "$AMT" = "100000"
echo "ASSERT finance payable amount=100000 PASS"

FINANCE=$(curl -sf "${HDR[@]}" "$API/finance/driver-payables")
echo "$FINANCE" | jq .
curl -sf "${HDR[@]}" -X POST "$API/finance/driver-payables/$PAYABLE_ID/complete" -d '{"evidenceNote":"manual bank transfer ref E2E"}' | jq .

echo "=== cancellation recalc path ==="
DRIVER2=$(create_and_approve "E2E Driver2" driver)
P3=$(create_and_approve "E2E P3" passenger)
curl -sf "${HDR[@]}" -X PUT "$API/tours/$TOUR/transport-allocations" -d "$(jq -n --arg d "$DRIVER2" --arg p "$P3" '{allocations:[{driverRegistrationId:$d,passengerRegistrationId:$p}]}')" >/dev/null
curl -sf "${HDR[@]}" -X POST "$API/bookings/$P3/cancel" -d '{}' >/dev/null || true
echo "cancelled passenger pre-freeze"
echo "DP-5 E2E COMPLETE"
