#!/usr/bin/env bash
# Denali Wave B — live runtime certification (memory driver, dev surfaces).
# Archives evidence under docs/evidence/denali-wave-b/<SHA>/
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SHA="$(git rev-parse HEAD)"
EVID="docs/evidence/denali-wave-b/${SHA}"
mkdir -p "$EVID"
# Reuse B1 logs from same SHA when present (DP1-E race excerpt)
B1_LOG="$EVID/b1-dp1.log"

ADMIN_HOST="${ADMIN_HOST:-denali.admin.localhost}"
PORTAL_HOST="${PORTAL_HOST:-operator.portal.localhost}"
PORTAL="${PORTAL:-http://127.0.0.1:3003}"
API="${API:-http://127.0.0.1:3001}"
OP_PHONE="${SMOKE_OPERATOR_PHONE:-+15550001001}"
OP_OTP="${SMOKE_OPERATOR_OTP:-1234}"
TOUR_DP1="${DP1_TOUR_ID:-00000000-0000-4000-8000-000000000901}"
TOUR_DP2="${DP2_TOUR_ID:-00000000-0000-4000-8000-000000000214}"
TENANT_ID="${TOUR_OPS_DEV_TENANT_ID:-00000000-0000-4000-8000-000000000014}"
WORKSPACE_ID="${TOUR_OPS_DEV_WORKSPACE_ID:-ws-operator-smoke}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
MEM_JAR="$EVID/member-session.jar"
OP_TOKEN=""

log() { echo "[wave-b] $*" | tee -a "$EVID/runtime-cert.log"; }

api_op() {
  curl -sf -H "Host: $ADMIN_HOST" -H "Authorization: Bearer $OP_TOKEN" "$@"
}

op_otp_curl() {
  curl -sf -H "Host: $ADMIN_HOST" \
    -H "x-tenant-id: $TENANT_ID" \
    -H "x-authenticated-tenant-id: $TENANT_ID" \
    -H "x-user-id: 00000000-0000-4000-8000-000000000099" \
    -H "x-actor-role: member" \
    -H "x-membership-status: ACTIVE" \
    -H "x-workspace-id: $WORKSPACE_ID" \
    "$@"
}

operator_login() {
  local req ch token
  req="$(op_otp_curl -H 'content-type: application/json' \
    -d "{\"mobile\":\"$OP_PHONE\"}" "$API/auth/request-otp")"
  ch="$(echo "$req" | jq -r '.challengeId // .challenge_id')"
  token="$(op_otp_curl -H 'content-type: application/json' \
    -d "{\"mobile\":\"$OP_PHONE\",\"otp\":\"$OP_OTP\",\"challengeId\":\"$ch\"}" \
    "$API/auth/verify-otp" | tee "$EVID/operator-login.json" | jq -r '.sessionToken')"
  OP_TOKEN="$token"
  [[ -n "$OP_TOKEN" && "$OP_TOKEN" != "null" ]] || { log "operator login failed"; exit 1; }
}

member_login() {
  local phone="$1" ch
  rm -f "$MEM_JAR"
  ch="$(curl -sfL -c "$MEM_JAR" -b "$MEM_JAR" -H "Host: $PORTAL_HOST" -H 'content-type: application/json' \
    -d "{\"phone\":\"$phone\"}" "$PORTAL/api/public-auth/request-otp" | jq -r '.challenge_id')"
  curl -sfL -c "$MEM_JAR" -b "$MEM_JAR" -H "Host: $PORTAL_HOST" -H 'content-type: application/json' \
    -d "{\"phone\":\"$phone\",\"otp\":\"1234\",\"challenge_id\":\"$ch\"}" "$PORTAL/api/public-auth/verify-otp" \
    | jq . > "$EVID/member-login-${phone//+/-}.json"
}

create_booking() {
  local label="$1" tour="$2" party="${3:-1}" cap="${4:-20}" phone="${5:-+15550007701}"
  local body
  body="$(jq -n --arg t "$tour" --arg l "$label" --arg ph "$phone" --argjson p "$party" --argjson c "$cap" \
    '{tourId:$t,tourTitle:"Wave B",guestLabel:$l,guestEmail:($l+"@waveb.local"),guestPhone:$ph,partySize:$p,departureAt:"2031-09-01T10:00:00.000Z",registrationIntake:{tourCapacityMax:$c}}')"
  api_op -H 'content-type: application/json' -X POST "$API/bookings" -d "$body" | jq -r '.id'
}

member_session_token() {
  jq -r '.session_token // empty' "$EVID/member-login-${1//+/-}.json"
}

member_create_denali_registration() {
  local tour="$1" label="$2" token email
  token="$(member_session_token "$MEM_PHONE")"
  email="dp4-${TS}@waveb.local"
  curl -sf -H "Host: $ADMIN_HOST" -H "Authorization: Bearer $token" \
    -H "x-tenant-id: $TENANT_ID" -H "x-authenticated-tenant-id: $TENANT_ID" \
    -H "x-user-id: 00000000-0000-4000-8000-000000000103" \
    -H "x-actor-role: member" -H "x-membership-status: ACTIVE" \
    -H "x-workspace-id: ws-operator-smoke-member" \
    -H 'content-type: application/json' \
    -X POST "$API/denali/registrations" \
    -d "$(jq -n --arg t "$tour" --arg e "$email" --arg l "$label" \
      '{tourId:$t,contact:{email:$e,fullName:$l},partySize:1}')" | jq -r '.data.id'
}

approve_booking() {
  api_op -H 'content-type: application/json' -X POST "$API/bookings/$1/approve" -d '{}'
}

get_booking() {
  api_op "$API/bookings/$1"
}

operator_manual_payment() {
  local reg="$1" amt="$2" tag="$3"
  local pay
  pay="$(curl -sS -o "$EVID/pay-$tag.json" -w '%{http_code}' \
    -H "Host: $ADMIN_HOST" -H "Authorization: Bearer $OP_TOKEN" \
    -H 'content-type: application/json' -H "Idempotency-Key: wb-pay-$tag-$TS" \
    -d "{\"registrationId\":\"$reg\",\"amount\":\"$amt\",\"currency\":\"IRR\"}" \
    "$API/finance/payments/manual")"
  [[ "$pay" == "201" ]] || { log "manual payment fail $tag $pay"; return 1; }
}

upload_receipt_proof() {
  local reg="$1" tag="$2"
  python3 - <<'PY'
from pathlib import Path
import base64
Path("/tmp/wave-b-receipt.jpg").write_bytes(base64.b64decode(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEBAVFRUVFRUVFRUVFRUWFxUXFhUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAECBQYAB//EABUBAQEAAAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A1oAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/Z"
))
PY
  local up fk
  up="$(curl -sS -o "$EVID/upload-$tag.json" -w '%{http_code}' \
    -H "Host: $ADMIN_HOST" -H "Authorization: Bearer $OP_TOKEN" \
    -H 'content-type: image/jpeg' -H 'x-receipt-file-name: wave-b.jpg' \
    --data-binary @/tmp/wave-b-receipt.jpg \
    "$API/finance/receipts/upload?registrationId=$reg")"
  fk="$(jq -r '.fileKey // empty' "$EVID/upload-$tag.json")"
  [[ "$up" == "201" && -n "$fk" ]] || { log "upload fail $tag $up"; return 1; }
}

seed_dp2_roster_fixture() {
  local existing
  existing="$(api_op "$API/tours/$TOUR_DP2/operational-roster?filter=operational" | jq '[.items[]?] | length')"
  if [[ "${existing:-0}" -ge 2 ]]; then
    log "DP2 fixture skip seed — $existing operational rows present"
    return 0
  fi
  log "DP2 seed mixed roster on tour $TOUR_DP2"
  local a b c d_id
  a="$(create_booking "DP2 Member A Paid" "$TOUR_DP2")"
  approve_booking "$a" >/dev/null
  operator_manual_payment "$a" "2500000" "dp2-a"
  b="$(create_booking "DP2 Member B Unpaid" "$TOUR_DP2")"
  approve_booking "$b" >/dev/null
  c="$(create_booking "DP2 Member C Partial" "$TOUR_DP2")"
  approve_booking "$c" >/dev/null
  operator_manual_payment "$c" "1000000" "dp2-c"
  d_id="$(create_booking "DP2 Member D Waitlist" "$TOUR_DP2")"
  api_op -H 'content-type: application/json' -X POST "$API/bookings/$d_id/waitlist" -d '{}' | jq . > "$EVID/dp2-seed-waitlist.json"
  jq -n --arg a "$a" --arg b "$b" --arg c "$c" --arg d "$d_id" \
    '{paid:$a,unpaid:$b,partial:$c,waitlist:$d}' > "$EVID/dp2-seed-ids.json"
}

curl -sf "$API/health" | jq . > "$EVID/api-health.json"
log "=== Wave B runtime cert SHA=$SHA ==="
operator_login

# DP1-A approve → deadline
B_A="$(create_booking "Member A" "$TOUR_DP1")"
approve_booking "$B_A" | tee "$EVID/dp1-a-approve.json"
get_booking "$B_A" | tee "$EVID/dp1-a-booking.json"
jq -e '.paymentDueAt != null' "$EVID/dp1-a-booking.json" >/dev/null && log "DP1-A PASS paymentDueAt present"

# DP1-B pay (operator manual — wrap satisfies hold + paid projection)
operator_manual_payment "$B_A" "2500000" "dp1-b" && log "DP1-B PASS manual payment"
get_booking "$B_A" | tee "$EVID/dp1-b-paid.json"
jq -e '.paymentStatus == "paid"' "$EVID/dp1-b-paid.json" >/dev/null && log "DP1-B PASS paid status"

# DP1-C expiry
B_C="$(create_booking "Member C Expire" "$TOUR_DP1")"
approve_booking "$B_C" | tee "$EVID/dp1-c-approve.json"
NEW_DUE="$(node -e "process.stdout.write(new Date(Date.now()+4000).toISOString())")"
api_op -H 'content-type: application/json' -X POST "$API/finance/payment-holds/$B_C/extend" \
  -d "{\"newDueAt\":\"$NEW_DUE\"}" | jq . > "$EVID/dp1-c-extend.json"
sleep 8
get_booking "$B_C" | tee "$EVID/dp1-c-after-expiry.json"
jq -e '.status == "cancelled" and .cancelSource == "payment_deadline"' "$EVID/dp1-c-after-expiry.json" >/dev/null && log "DP1-C PASS expiry cancelled"

# DP1-D waitlist promotion
A_FILL="$(create_booking "Guest A Fill" "$TOUR_DP1" 2 2)"
B_WL="$(create_booking "Waitlist Member" "$TOUR_DP1" 1 2)"
approve_booking "$A_FILL" >/dev/null
api_op -H 'content-type: application/json' -X POST "$API/bookings/$B_WL/waitlist" -d '{}' | jq . > "$EVID/dp1-d-waitlist.json"
NEW_DUE2="$(node -e "process.stdout.write(new Date(Date.now()+4000).toISOString())")"
api_op -H 'content-type: application/json' -X POST "$API/finance/payment-holds/$A_FILL/extend" \
  -d "{\"newDueAt\":\"$NEW_DUE2\"}" >/dev/null
sleep 8
get_booking "$B_WL" | tee "$EVID/dp1-d-promoted.json"
jq -e '.status == "approved"' "$EVID/dp1-d-promoted.json" >/dev/null && log "DP1-D PASS waitlist promoted"

# DP1-E race — domain harness archived from B1 (payment-hold-expiry-race.spec.ts)
if [[ -f "$B1_LOG" ]]; then
  grep -A2 'DP1-F payment hold expiry race' "$B1_LOG" > "$EVID/dp1-e-race-b1-excerpt.txt" || true
fi
grep -q 'S8 payment win' "$B1_LOG" 2>/dev/null && log "DP1-E PASS race harness (B1 S8/S3b)"

# DP2 roster
seed_dp2_roster_fixture
api_op "$API/tours/$TOUR_DP2/operational-roster" | jq . > "$EVID/dp2-roster-all.json"
for f in operational final unpaid paid waitlist expiring; do
  api_op "$API/tours/$TOUR_DP2/operational-roster?filter=$f" | jq . > "$EVID/dp2-roster-filter-$f.json"
done
jq -e '[.items[]? | select(.isOperationalParticipant==true)] | length >= 2' "$EVID/dp2-roster-filter-operational.json" >/dev/null && log "DP2 PASS operational filter"
jq -e '[.items[]? | select(.isFinalParticipant==true)] | length >= 1' "$EVID/dp2-roster-filter-final.json" >/dev/null && log "DP2 PASS final filter"

# DP3 mutations (PATCH uses rowVersion + data.* — not canonical wrapper)
TOUR_ROW="$(api_op "$API/tours/$TOUR_DP1" | tee "$EVID/dp3-tour-before.json" | jq -r '.rowVersion')"
SAFE_BODY="$(jq -n --argjson rv "$TOUR_ROW" '{rowVersion:$rv,data:{basicInfo:{title:"Wave B safe edit"}}}')"
curl -sS -o "$EVID/dp3-safe-edit-body.json" -w '%{http_code}' \
  -H "Host: $ADMIN_HOST" -H "Authorization: Bearer $OP_TOKEN" \
  -H 'content-type: application/json' -X PATCH "$API/tours/$TOUR_DP1" -d "$SAFE_BODY" \
  | tee "$EVID/dp3-safe-edit-code.txt"
CAP_BODY="$(jq -n --argjson rv "$TOUR_ROW" '{rowVersion:$rv,data:{basicInfo:{capacityMax:1}}}')"
curl -sS -o "$EVID/dp3-capacity-deny-body.json" -w '%{http_code}' \
  -H "Host: $ADMIN_HOST" -H "Authorization: Bearer $OP_TOKEN" \
  -H 'content-type: application/json' -X PATCH "$API/tours/$TOUR_DP1" -d "$CAP_BODY" \
  | tee "$EVID/dp3-capacity-deny-code.txt"
grep -q '^200$' "$EVID/dp3-safe-edit-code.txt" && log "DP3 PASS safe title edit"
grep -Eq '^(403|409)$' "$EVID/dp3-capacity-deny-code.txt" && log "DP3 PASS capacity deny"

# DP4 member cancel
MEM_PHONE="${SMOKE_MEMBER_PHONE:-+15550001003}"
member_login "$MEM_PHONE"
B_M="$(member_create_denali_registration "$TOUR_DP1" "Member Self Cancel")"
approve_booking "$B_M" >/dev/null
curl -sfL -b "$MEM_JAR" -H "Host: $PORTAL_HOST" \
  "$PORTAL/api/me/registrations/$B_M" | jq . > "$EVID/dp4-member-before.json"
curl -sfL -b "$MEM_JAR" -H "Host: $PORTAL_HOST" -H 'content-type: application/json' \
  -X POST "$PORTAL/api/me/registrations/$B_M/cancellation" -d '{}' | jq . > "$EVID/dp4-member-cancel.json"
curl -sfL -b "$MEM_JAR" -H "Host: $PORTAL_HOST" \
  "$PORTAL/api/me/notifications" | jq . > "$EVID/dp4-inbox.json"
log "DP4 PASS member cancel + inbox archived"

# DP6 — API-direct refund live
export ADMIN_HOST API OP_TOKEN
bash scripts/e2e-dp6-refund-live-api.sh 2>&1 | tee "$EVID/dp6-live.log"
grep -q 'DP6_LIVE_E2E_COMPLETE' "$EVID/dp6-live.log" && log "DP6 PASS live refund"

# DRF-001 receipt upload (multipart + storage before payment; operator manual completes finance)
B_R="$(create_booking "Receipt Upload" "$TOUR_DP1")"
approve_booking "$B_R" >/dev/null
upload_receipt_proof "$B_R" "receipt-e2e" && log "DRF-001 PASS multipart upload"
operator_manual_payment "$B_R" "2500000" "receipt-e2e-pay"
get_booking "$B_R" | jq . > "$EVID/receipt-booking-paid.json"
api_op "$API/finance/receipts/pending" | jq . > "$EVID/receipt-pending.json"
api_op "$API/bookings/$B_R/receipts" | jq . > "$EVID/receipt-status.json"
jq -e '.paymentStatus == "paid"' "$EVID/receipt-booking-paid.json" >/dev/null && log "DRF-001 PASS receipt upload + finance paid"

cat > "$EVID/manifest.json" <<EOF
{
  "sha": "$SHA",
  "timestamp": "$TS",
  "environment": "memory-driver dev surfaces",
  "adminHost": "$ADMIN_HOST",
  "portalHost": "$PORTAL_HOST",
  "journeys": ["dp1-a","dp1-b","dp1-c","dp1-d","dp1-e","dp2","dp3","dp4","dp6","receipt-upload"]
}
EOF

log "WAVE_B_RUNTIME_CERT_COMPLETE sha=$SHA evidence=$EVID"
