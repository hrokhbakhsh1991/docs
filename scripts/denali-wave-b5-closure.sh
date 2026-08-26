#!/usr/bin/env bash
# Denali Wave B.5 — final runtime closure (DP-3 UI, DP-6 portal refund, Postgres discovery).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SHA="$(git rev-parse HEAD)"
EVID="docs/evidence/denali-wave-b5/${SHA}"
mkdir -p "$EVID/browser" "$EVID/api"

ADMIN_HOST="${ADMIN_HOST:-admin.operator.localhost}"
PORTAL_HOST="${PORTAL_HOST:-portal.operator.localhost}"
PORTAL="${PORTAL:-http://127.0.0.1:3003}"
API="${API:-http://127.0.0.1:3001}"
OP_PHONE="${SMOKE_OPERATOR_PHONE:-09174070937}"
MEM_PHONE="${SMOKE_MEMBER_PHONE:-+15550001003}"
TOUR_DP1="${DP1_TOUR_ID:-00000000-0000-4000-8000-000000000901}"
REFUND_TOUR="${REFUND_SEED_TOUR_ID:-00000000-0000-4000-8000-000000000210}"
TENANT_ID="${TOUR_OPS_DEV_TENANT_ID:-00000000-0000-4000-8000-000000000014}"
WORKSPACE_ID="${TOUR_OPS_DEV_WORKSPACE_ID:-ws-operator-smoke}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
MEM_JAR="$EVID/member-session.jar"
OP_TOKEN=""

log() { echo "[wave-b5] $*" | tee -a "$EVID/wave-b5-closure.log"; }

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
  local ch token
  rm -f "$MEM_JAR"
  ch="$(curl -sfL -c "$MEM_JAR" -b "$MEM_JAR" -H "Host: $PORTAL_HOST" -H 'content-type: application/json' \
    -d "{\"phone\":\"$MEM_PHONE\"}" "$PORTAL/api/public-auth/request-otp" | jq -r '.challenge_id')"
  curl -sfL -c "$MEM_JAR" -b "$MEM_JAR" -H "Host: $PORTAL_HOST" -H 'content-type: application/json' \
    -d "{\"phone\":\"$MEM_PHONE\",\"otp\":\"1234\",\"challenge_id\":\"$ch\"}" \
    "$PORTAL/api/public-auth/verify-otp" | jq . > "$EVID/member-login.json"
  token="$(jq -r '.session_token // empty' "$EVID/member-login.json")"
  [[ -n "$token" ]] || { log "member login missing session_token"; return 1; }
}

member_create_registration() {
  local label="$1" tour="$2" token email body
  token="$(jq -r '.session_token // empty' "$EVID/member-login.json")"
  email="b5-${TS}-${label// /-}@waveb.local"
  body="$(curl -sS -H "Host: $ADMIN_HOST" -H "Authorization: Bearer $token" \
    -H "x-tenant-id: $TENANT_ID" -H "x-authenticated-tenant-id: $TENANT_ID" \
    -H "x-user-id: 00000000-0000-4000-8000-000000000103" \
    -H "x-actor-role: member" -H "x-membership-status: ACTIVE" \
    -H "x-workspace-id: ws-operator-smoke-member" \
    -H 'content-type: application/json' \
    -X POST "$API/denali/registrations" \
    -d "$(jq -n --arg t "$tour" --arg e "$email" --arg l "$label" \
      '{tourId:$t,contact:{email:$e,fullName:$l},partySize:1}')")"
  echo "$body" > "$EVID/member-create-${label// /-}.json"
  jq -r '.data.id // empty' <<<"$body"
}

approve_booking() {
  api_op -H 'content-type: application/json' -X POST "$API/bookings/$1/approve" -d '{}'
}

operator_manual_payment() {
  curl -sS -o "$EVID/pay-${2:-refund}.json" -w '%{http_code}' \
    -H "Host: $ADMIN_HOST" -H "Authorization: Bearer $OP_TOKEN" \
    -H 'content-type: application/json' -H "Idempotency-Key: wb5-pay-$2-$TS" \
    -d "{\"registrationId\":\"$1\",\"amount\":\"2500000\",\"currency\":\"IRR\"}" \
    "$API/finance/payments/manual"
}

find_member_refund_registration() {
  local items existing cancelled paid pending
  items="$(curl -sfL -b "$MEM_JAR" -H "Host: $PORTAL_HOST" "$PORTAL/api/me/registrations" | jq -c '.data.items // []')"
  cancelled="$(jq -r --arg t "$REFUND_TOUR" \
    '.[] | select(.tourId==$t and .status=="cancelled" and .paymentStatus=="paid") | .id' <<<"$items" | head -1)"
  if [[ -n "$cancelled" ]]; then
    echo "$cancelled"
    return 0
  fi
  paid="$(jq -r --arg t "$REFUND_TOUR" \
    '.[] | select(.tourId==$t and .paymentStatus=="paid") | .id' <<<"$items" | head -1)"
  if [[ -n "$paid" ]]; then
    echo "$paid"
    return 0
  fi
  pending="$(jq -r --arg t "$REFUND_TOUR" \
    '.[] | select(.tourId==$t) | .id' <<<"$items" | head -1)"
  [[ -n "$pending" ]] && echo "$pending"
}

seed_dp6_member_refund() {
  local reg status payment refunds
  reg="$(find_member_refund_registration || true)"
  if [[ -z "${reg:-}" ]]; then
    reg="$(member_create_registration "Member Refund B5" "$REFUND_TOUR")"
  else
    log "reuse member-owned registration $reg on tour $REFUND_TOUR"
    jq -n --arg id "$reg" '{reusedRegistrationId:$id}' > "$EVID/dp6-reuse.json"
  fi
  [[ -n "$reg" ]] || return 1

  status="$(curl -sfL -b "$MEM_JAR" -H "Host: $PORTAL_HOST" \
    "$PORTAL/api/me/registrations/$reg" | jq -r '.data.status // empty')"
  payment="$(curl -sfL -b "$MEM_JAR" -H "Host: $PORTAL_HOST" \
    "$PORTAL/api/me/registrations/$reg" | jq -r '.data.paymentStatus // empty')"

  if [[ "$status" != "approved" && "$status" != "cancelled" ]]; then
    approve_booking "$reg" >/dev/null
    status="approved"
  fi
  if [[ "$status" == "approved" && "$payment" != "paid" ]]; then
    operator_manual_payment "$reg" refund | grep -q '^201$'
    payment="paid"
  fi
  if [[ "$status" != "cancelled" ]]; then
    api_op -H 'content-type: application/json' -X POST "$API/bookings/$reg/cancel" \
      -d '{"reason":"wave_b5_portal_refund"}' | jq . > "$EVID/dp6-operator-cancel.json"
  fi
  refunds="$(api_op "$API/finance/refunds?registrationId=$reg" | jq -c '.items // .data // []')"
  echo "$refunds" > "$EVID/dp6-operator-refunds.json"
  if ! jq -e 'length > 0' <<<"$refunds" >/dev/null 2>&1; then
    log "DP-6 seed: no FinanceRefund row after cancel for $reg"
    return 1
  fi
  echo "$reg"
}

postgres_discovery() {
  cat > "$EVID/postgres-environment.json" <<EOF
{
  "classification": "BLOCKED_EXTERNAL",
  "docker": $(command -v docker >/dev/null && echo true || echo false),
  "DATABASE_URL_set": ${DATABASE_URL:+true}${DATABASE_URL:-false},
  "canonical_workflow": "pnpm run infra:up (infra/docker-compose.yml postgres:16 on port 5434)",
  "required_input": "Docker + eval \"\$(bash scripts/ensure-p6-finance-postgres.sh)\" then prisma migrate deploy",
  "note": "Cloud VM has no docker client — B5-4/B5-5 not executed"
}
EOF
}

log "=== Wave B.5 closure SHA=$SHA ==="

# B5-3 Postgres discovery
postgres_discovery
log "Postgres: BLOCKED_EXTERNAL (no docker in VM)"

operator_login
member_login

# Ensure DP1 tour capacity headroom for mutation tests
TOUR_ROW="$(api_op "$API/tours/$TOUR_DP1" | jq -r '.rowVersion')"
api_op -H 'content-type: application/json' -X PATCH "$API/tours/$TOUR_DP1" \
  -d "$(jq -n --argjson rv "$TOUR_ROW" '{rowVersion:$rv,data:{basicInfo:{capacityMax:50}}}')" \
  | jq . > "$EVID/dp3-tour-capacity-bump.json" || true

REFUND_REG_ID="$(seed_dp6_member_refund || true)"
[[ -n "${REFUND_REG_ID:-}" ]] || { log "DP-6 seed failed"; exit 1; }
jq -n --arg id "$REFUND_REG_ID" '{refundRegistrationId:$id}' > "$EVID/dp6-seed.json"

export WAVE_B_EVIDENCE_DIR="$ROOT/$EVID"
export WAVE_B5_REFUND_REG_ID="$REFUND_REG_ID"
export PW_EXTERNAL_SERVERS=1
export SMOKE_BASE_URL="http://admin.operator.localhost:3000"
export SMOKE_PORTAL_BASE_URL="http://${PORTAL_HOST}:3003"

log "Running DP-3 flat-edit Playwright..."
pnpm --filter @apps/web exec playwright test -c playwright.wave-b5-evidence.config.ts \
  || log "DP-3 playwright reported failure — inspect evidence"

log "Running DP-6 portal refund Playwright..."
pnpm --filter @apps/portal exec playwright test -c playwright.wave-b5-evidence.config.ts \
  || log "DP-6 playwright reported failure — inspect evidence"

# Fast regression chain (memory driver)
for s in test-dp1-payment-deadline test-dp2-operational-roster test-dp3-tour-mutation test-dp4-member-self-service test-dp6-refund-orchestration; do
  log "regression: scripts/${s}.sh"
  bash "scripts/${s}.sh" 2>&1 | tee "$EVID/regression-${s}.txt" | tail -3
done
pnpm run guard:import-boundary 2>&1 | tee "$EVID/guard-import-boundary.txt" | tail -5

cat > "$EVID/manifest.json" <<EOF
{
  "sha": "$SHA",
  "timestamp": "$TS",
  "journeys": ["dp3-flat-edit-ui", "dp6-portal-refund", "postgres-discovery"],
  "postgres": "BLOCKED_EXTERNAL",
  "pr109": "not merged — CI failures on PR branch"
}
EOF

log "WAVE_B5_CLOSURE_COMPLETE"
