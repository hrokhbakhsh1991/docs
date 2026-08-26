#!/usr/bin/env bash
# Denali Wave B — browser screenshot evidence (portal + operator web).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SHA="$(git rev-parse HEAD)"
EVID="docs/evidence/denali-wave-b/${SHA}"
mkdir -p "$EVID/browser"

ADMIN_HOST="${ADMIN_HOST:-denali.admin.localhost}"
PORTAL_HOST="${PORTAL_HOST:-portal.operator.localhost}"
PORTAL="${PORTAL:-http://127.0.0.1:3003}"
API="${API:-http://127.0.0.1:3001}"
OP_PHONE="${SMOKE_OPERATOR_PHONE:-09174070937}"
MEM_PHONE="${SMOKE_MEMBER_PHONE:-+15550001003}"
TOUR_DP1="${DP1_TOUR_ID:-00000000-0000-4000-8000-000000000901}"
TOUR_DP2="${DP2_TOUR_ID:-00000000-0000-4000-8000-000000000214}"
TENANT_ID="${TOUR_OPS_DEV_TENANT_ID:-00000000-0000-4000-8000-000000000014}"
WORKSPACE_ID="${TOUR_OPS_DEV_WORKSPACE_ID:-ws-operator-smoke}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
MEM_JAR="$EVID/member-session-browser.jar"
OP_TOKEN=""

log() { echo "[wave-b-browser] $*" | tee -a "$EVID/browser-evidence.log"; }

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
  local req ch
  req="$(op_otp_curl -H 'content-type: application/json' \
    -d "{\"mobile\":\"$OP_PHONE\"}" "$API/auth/request-otp")"
  ch="$(echo "$req" | jq -r '.challengeId // .challenge_id')"
  OP_TOKEN="$(op_otp_curl -H 'content-type: application/json' \
    -d "{\"mobile\":\"$OP_PHONE\",\"otp\":\"1234\",\"challengeId\":\"$ch\"}" \
    "$API/auth/verify-otp" | jq -r '.sessionToken')"
  [[ -n "$OP_TOKEN" && "$OP_TOKEN" != "null" ]] || { log "operator login failed"; exit 1; }
}

member_login() {
  local ch
  rm -f "$MEM_JAR"
  ch="$(curl -sfL -c "$MEM_JAR" -b "$MEM_JAR" -H "Host: $PORTAL_HOST" -H 'content-type: application/json' \
    -d "{\"phone\":\"$MEM_PHONE\"}" "$PORTAL/api/public-auth/request-otp" | jq -r '.challenge_id')"
  curl -sfL -c "$MEM_JAR" -b "$MEM_JAR" -H "Host: $PORTAL_HOST" -H 'content-type: application/json' \
    -d "{\"phone\":\"$MEM_PHONE\",\"otp\":\"1234\",\"challenge_id\":\"$ch\"}" \
    "$PORTAL/api/public-auth/verify-otp" | jq . > "$EVID/browser-member-login.json"
}

member_create_registration() {
  local label="$1" tour="${2:-$TOUR_DP1}" token email body
  token="$(jq -r '.session_token // empty' "$EVID/browser-member-login.json")"
  [[ -n "$token" ]] || { log "member session token missing"; return 1; }
  email="browser-${TS}-${label// /-}@waveb.local"
  body="$(curl -sS -H "Host: $ADMIN_HOST" -H "Authorization: Bearer $token" \
    -H "x-tenant-id: $TENANT_ID" -H "x-authenticated-tenant-id: $TENANT_ID" \
    -H "x-user-id: 00000000-0000-4000-8000-000000000103" \
    -H "x-actor-role: member" -H "x-membership-status: ACTIVE" \
    -H "x-workspace-id: ws-operator-smoke-member" \
    -H 'content-type: application/json' \
    -X POST "$API/denali/registrations" \
    -d "$(jq -n --arg t "$tour" --arg e "$email" --arg l "$label" \
      '{tourId:$t,contact:{email:$e,fullName:$l},partySize:1}')")"
  echo "$body" > "$EVID/browser-member-create-${label// /-}.json"
  jq -r '.data.id // empty' <<<"$body"
}

create_booking() {
  local label="$1" tour="$2" party="${3:-1}" cap="${4:-50}" phone="${5:-+15550007701}"
  api_op -H 'content-type: application/json' -X POST "$API/bookings" \
    -d "$(jq -n --arg t "$tour" --arg l "$label" --arg ph "$phone" --argjson p "$party" --argjson c "$cap" \
      '{tourId:$t,tourTitle:"Wave B",guestLabel:$l,guestEmail:($l+"@waveb.local"),guestPhone:$ph,partySize:$p,departureAt:"2031-09-01T10:00:00.000Z",registrationIntake:{tourCapacityMax:$c}}')" \
    | jq -r '.id'
}

approve_booking() {
  api_op -H 'content-type: application/json' -X POST "$API/bookings/$1/approve" -d '{}'
}

operator_manual_payment() {
  curl -sS -o "$EVID/browser-pay.json" -w '%{http_code}' \
    -H "Host: $ADMIN_HOST" -H "Authorization: Bearer $OP_TOKEN" \
    -H 'content-type: application/json' -H "Idempotency-Key: wb-browser-pay-$TS" \
    -d "{\"registrationId\":\"$1\",\"amount\":\"2500000\",\"currency\":\"IRR\"}" \
    "$API/finance/payments/manual"
}

seed_refund_registration() {
  local reg tour="${REFUND_SEED_TOUR_ID:-00000000-0000-4000-8000-000000000210}"
  reg="$(member_create_registration "Browser Refund Seed" "$tour")"
  [[ -n "$reg" ]] || return 1
  approve_booking "$reg" >/dev/null
  operator_manual_payment "$reg" | grep -q '^201$'
  api_op -H 'content-type: application/json' -X POST "$API/bookings/$reg/cancel" \
    -d '{"reason":"wave_b_browser_refund"}' | jq . > "$EVID/browser-refund-cancel.json"
  echo "$reg"
}

log "=== Wave B browser evidence SHA=$SHA ==="
curl -sf "$API/health" | jq . > "$EVID/browser-api-health.json"

operator_login

# Ensure DP1 tour has headroom for browser seed (memory driver accumulates occupancy).
TOUR_ROW="$(api_op "$API/tours/$TOUR_DP1" | jq -r '.rowVersion')"
CAP_BODY="$(jq -n --argjson rv "$TOUR_ROW" '{rowVersion:$rv,data:{basicInfo:{capacityMax:50}}}')"
api_op -H 'content-type: application/json' -X PATCH "$API/tours/$TOUR_DP1" -d "$CAP_BODY" | jq . > "$EVID/browser-capacity-bump.json" || true

member_login
EXISTING_REG="$(curl -sfL -b "$MEM_JAR" -H "Host: $PORTAL_HOST" \
  "$PORTAL/api/me/registrations" | jq -r --arg t "$TOUR_DP1" \
  '.data.items[]? | select(.tourId==$t and .status=="approved" and .paymentStatus=="unpaid") | .id' | head -1)"
if [[ -n "$EXISTING_REG" ]]; then
  REG_ID="$EXISTING_REG"
  log "reuse existing approved unpaid registration $REG_ID"
else
  REG_ID="$(member_create_registration "Browser DP4 Unpaid")"
fi
[[ -n "$REG_ID" ]] || { log "member registration seed failed"; exit 1; }
if [[ -n "$EXISTING_REG" ]]; then
  log "skip approve — reusing $REG_ID"
else
  approve_booking "$REG_ID" | jq . > "$EVID/browser-dp4-approve.json"
fi
jq -n --arg id "$REG_ID" '{registrationId:$id}' > "$EVID/browser-seed.json"
export WAVE_B_BROWSER_REG_ID="$REG_ID"

unset WAVE_B_BROWSER_REFUND_REG_ID || true
REFUND_REG_ID="$(seed_refund_registration || true)"
if [[ -n "${REFUND_REG_ID:-}" ]]; then
  export WAVE_B_BROWSER_REFUND_REG_ID="$REFUND_REG_ID"
  jq --arg refund "$REFUND_REG_ID" '.refundRegistrationId=$refund' "$EVID/browser-seed.json" \
    > "$EVID/browser-seed.tmp.json" && mv "$EVID/browser-seed.tmp.json" "$EVID/browser-seed.json"
else
  log "refund browser seed skipped — DP-6 portal UI evidence may be omitted"
fi

export WAVE_B_EVIDENCE_DIR="$ROOT/$EVID"
export PW_EXTERNAL_SERVERS=1
export SMOKE_PORTAL_BASE_URL="http://${PORTAL_HOST}:3003"
export SMOKE_BASE_URL="http://${ADMIN_HOST}:3000"

log "Running portal playwright evidence..."
pnpm --filter @apps/portal exec playwright test -c playwright.wave-b-evidence.config.ts

log "Running operator web playwright evidence..."
pnpm --filter @apps/web exec playwright test -c playwright.wave-b-evidence.config.ts

cat > "$EVID/browser/manifest.json" <<EOF
{
  "sha": "$SHA",
  "timestamp": "$TS",
  "portalHost": "$PORTAL_HOST",
  "adminHost": "$ADMIN_HOST",
  "seedRegistrationId": "$REG_ID",
  "refundRegistrationId": "$REFUND_REG_ID",
  "screenshots": [
    "dp4-registrations-1440.png",
    "dp4-registrations-390.png",
    "dp1-member-deadline-1440.png",
    "dp4-member-detail-cancel-1440.png",
    "dp4-member-detail-cancel-390.png",
    "dp6-member-refund-1440.png",
    "dp2-roster-1440.png",
    "dp2-roster-filter-final-1440.png",
    "dp3-tour-workspace-1440.png"
  ]
}
EOF

log "WAVE_B_BROWSER_EVIDENCE_COMPLETE"
